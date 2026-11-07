package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Run against an explicitly selected local development database. The fixture
// is isolated and removed; no real user or existing conversation is modified.
func TestSharedContentFiltersAndPagingIntegration(t *testing.T) {
	if os.Getenv("CHATNET_SHARED_CONTENT_TEST") != "1" {
		t.Skip("opt-in local PostgreSQL integration")
	}
	const dsn = "postgres://chatnet:chatnet@127.0.0.1:5432/chatnet?sslmode=disable"
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}

	ids := make([]int64, 3)
	names := make([]string, 3)
	for i := range ids {
		names[i] = fmt.Sprintf("shared_%d_%d", time.Now().UnixNano(), i)
		if err = db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
   VALUES($1,$2,'!',$2) RETURNING id`, names[i]+"@example.invalid", names[i]).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		// Remove the group before its creator for FK-safe cleanup.
		if _, err := db.Exec(cleanup, `DELETE FROM conversations WHERE created_by=$1`, ids[0]); err != nil {
			t.Errorf("cleanup group: %v", err)
		}
		for _, id := range ids {
			if _, err := db.Exec(cleanup, `DELETE FROM users WHERE id=$1`, id); err != nil {
				t.Errorf("cleanup user: %v", err)
			}
		}
	})
	var groupID int64
	if err = db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by)
  VALUES('group','shared-content-test',$1) RETURNING id`, ids[0]).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	for _, id := range ids[:2] {
		if _, err = db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)`, groupID, id); err != nil {
			t.Fatal(err)
		}
	}
	type seed struct{ label, kind string }
	cases := []seed{
		{"link-old", "link"},
		{"image-a", "image"},
		{"video-a", "video"},
		{"file-a", "file"},
		{"image-b", "image"},
		{"link-new", "link"},
		{"image-c", "image"},
		{"image-recalled", "image"},
	}
	inserted := map[string]int64{}
	for _, item := range cases {
		text := item.label
		if item.kind == "link" {
			text = "https://example.invalid/" + item.label
		}
		var id int64
		if err = db.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,text)
   VALUES($1,$2,$3) RETURNING id`, groupID, ids[0], text).Scan(&id); err != nil {
			t.Fatal(err)
		}
		inserted[item.label] = id
		if item.kind != "link" {
			if _, err = db.Exec(ctx, `INSERT INTO message_attachments(message_id,storage_ref,original_name,content_type,size_bytes,kind)
    VALUES($1,$2,$3,'application/octet-stream',10,$4)`, id, "s3://test-bucket/chatnet/chat/fixture/"+item.label, item.label, item.kind); err != nil {
				t.Fatal(err)
			}
		}
	}
	if _, err = db.Exec(ctx, `UPDATE messages SET deleted_at=now() WHERE id=$1`, inserted["image-recalled"]); err != nil {
		t.Fatal(err)
	}

	tokens := make([]string, 3)
	for i, id := range ids {
		tokens[i], err = authx.Sign("shared-test", id, names[i], names[i])
		if err != nil {
			t.Fatal(err)
		}
	}
	query := func(actor int, values string, want int) sharedContentPage {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/conversations/%d/shared?%s", groupID, values), nil)
		req.SetPathValue("id", fmt.Sprint(groupID))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		res := httptest.NewRecorder()
		authx.Middleware("shared-test", http.HandlerFunc(s.listSharedContent)).ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("GET shared %s actor %d: got %d want %d: %s", values, actor, res.Code, want, res.Body.String())
		}
		if got := res.Header().Get("Cache-Control"); !strings.Contains(got, "no-store") {
			t.Errorf("missing no-store: %s", got)
		}
		if want != http.StatusOK {
			return sharedContentPage{}
		}
		var page sharedContentPage
		if err := json.Unmarshal(res.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		return page
	}
	for _, tc := range []struct {
		kind string
		want []string
	}{
		{"images", []string{"image-c", "image-b", "image-a"}},
		{"videos", []string{"video-a"}},
		{"files", []string{"file-a"}},
		{"links", []string{"link-new", "link-old"}},
		{"media", []string{"image-c", "image-b", "video-a", "image-a"}},
	} {
		t.Run(tc.kind, func(t *testing.T) {
			page := query(1, "kind="+tc.kind+"&limit=50", http.StatusOK)
			if len(page.Items) != len(tc.want) || page.NextBefore != nil {
				t.Fatalf("%s: count=%d next=%v", tc.kind, len(page.Items), page.NextBefore)
			}
			for i, name := range tc.want {
				if !strings.Contains(page.Items[i].Text, name) {
					t.Errorf("%s item %d: %s", tc.kind, i, page.Items[i].Text)
				}
			}
		})
	}
	// limit+1 lookahead distinguishes an exact boundary from an extra page.
	first := query(1, "kind=images&limit=2", http.StatusOK)
	if len(first.Items) != 2 || first.NextBefore == nil {
		t.Fatalf("first page = %+v", first)
	}
	second := query(1, fmt.Sprintf("kind=images&limit=2&before=%d", *first.NextBefore), http.StatusOK)
	if len(second.Items) != 1 || second.NextBefore != nil {
		t.Fatalf("second page = %+v", second)
	}
	exact := query(1, "kind=images&limit=3", http.StatusOK)
	if len(exact.Items) != 3 || exact.NextBefore != nil {
		t.Fatalf("exact page = %+v", exact)
	}
	query(1, "kind=images&limit=51", http.StatusBadRequest)
	query(1, "kind=images&before=-1", http.StatusBadRequest)
	query(1, "kind=unknown", http.StatusBadRequest)
	query(2, "kind=images", http.StatusForbidden)

	if _, err = db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, ids[1], ids[0]); err != nil {
		t.Fatal(err)
	}
	hidden := query(1, "kind=media", http.StatusOK)
	if len(hidden.Items) != 0 {
		t.Fatalf("blocked media still visible: %+v", hidden)
	}
	visible := query(0, "kind=images", http.StatusOK)
	if len(visible.Items) != 3 {
		t.Fatalf("author media missing: %+v", visible)
	}
	if _, err = db.Exec(ctx, `DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2`, groupID, ids[1]); err != nil {
		t.Fatal(err)
	}
	query(1, "kind=images", http.StatusForbidden)
}
