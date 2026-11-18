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

func TestValidRepost(t *testing.T) {
	for _, tc := range []struct {
		kind, text string
		want       bool
	}{
		{"quick", "", true}, {"quick", "unexpected", false},
		{"quote", "", false}, {"quote", "ý kiến", true},
		{"quote", strings.Repeat("😀", 5000), true},
		{"quote", strings.Repeat("😀", 5001), false},
		{"quote", "bad\x00value", false}, {"other", "text", false},
	} {
		if got := validRepost(tc.kind, tc.text); got != tc.want {
			t.Errorf("validRepost(%q, %d bytes) = %v, want %v", tc.kind, len(tc.text), got, tc.want)
		}
	}
}

func TestRepostVisibilityAndUndoIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}

	const secret = "repost-integration-test-key"
	var ids [3]int64
	var tokens [3]string
	for i := range ids {
		name := fmt.Sprintf("repost_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
 VALUES($1,$2,'!', $2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		id := ids[i]
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
		tokens[i], err = authx.Sign(secret, id, name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	var sourceID int64
	if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content) VALUES ($1,'source text') RETURNING id`, ids[0]).Scan(&sourceID); err != nil {
		t.Fatal(err)
	}
	sourcePath := fmt.Sprintf("/api/posts/%d", sourceID)
	s := &server{db: db}
	mux := http.NewServeMux()
	for route, handler := range map[string]http.HandlerFunc{
		"GET /api/posts":                s.list,
		"GET /api/posts/{id}":           s.detailPost,
		"POST /api/posts/{id}/repost":   s.createRepost,
		"DELETE /api/posts/{id}/repost": s.removeRepost,
		"GET /api/feed/mentions":        s.listPostMentions,
	} {
		mux.Handle(route, authx.Middleware(secret, handler))
	}
	request := func(actor int, method, path, body string, want int) []byte {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("%s %s as %d: got %d, want %d: %s", method, path, actor, res.Code, want, res.Body.String())
		}
		return res.Body.Bytes()
	}
	readPost := func(b []byte) (p post) {
		t.Helper()
		if err := json.Unmarshal(b, &p); err != nil {
			t.Fatal(err)
		}
		return p
	}
	quick := readPost(request(1, "POST", sourcePath+"/repost", `{"kind":"quick"}`, 201))
	duplicate := readPost(request(1, "POST", sourcePath+"/repost", `{"kind":"quick"}`, 200))
	if quick.MyRepostID == 0 || duplicate.MyRepostID != quick.MyRepostID || duplicate.RepostCount != 1 {
		t.Fatalf("invalid quick repost state: %+v", duplicate)
	}
	quickPath := fmt.Sprintf("/api/posts/%d", quick.MyRepostID)
	p := readPost(request(2, "GET", quickPath, "", 200))
	if p.OriginalPost == nil || p.OriginalPost.ID != sourceID || p.Content != "" {
		t.Fatalf("invalid original: %+v", p)
	}
	request(1, "POST", quickPath+"/repost", `{"kind":"quick"}`, 404)
	request(1, "POST", sourcePath+"/repost", `{"kind":"quote","content":"my opinion"}`, 201)
	var mine []post
	if err := json.Unmarshal(request(1, "GET", "/api/posts?scope=mine", "", 200), &mine); err != nil {
		t.Fatal(err)
	}
	if len(mine) != 2 || mine[0].RepostKind != "quote" || mine[0].Content != "my opinion" {
		t.Fatalf("profile missing quote: %+v", mine)
	}
	var notices []postMention
	if err := json.Unmarshal(request(0, "GET", "/api/feed/mentions", "", 200), &notices); err != nil {
		t.Fatal(err)
	}
	if len(notices) != 2 || notices[0].Kind != "quote" || notices[1].Kind != "repost" {
		t.Fatalf("invalid notices: %+v", notices)
	}
	request(2, "DELETE", sourcePath+"/repost", "", 204)
	request(2, "GET", quickPath, "", 200)
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, ids[0], ids[2]); err != nil {
		t.Fatal(err)
	}
	request(2, "GET", quickPath, "", 404)
	if _, err := db.Exec(ctx, `UPDATE posts SET visibility='private' WHERE id=$1`, sourceID); err != nil {
		t.Fatal(err)
	}
	request(1, "GET", quickPath, "", 404)
	request(1, "POST", sourcePath+"/repost", `{"kind":"quick"}`, 404)
	request(1, "DELETE", sourcePath+"/repost", "", 204)
	request(1, "DELETE", sourcePath+"/repost", "", 204)
	if _, err := db.Exec(ctx, `DELETE FROM posts WHERE id=$1`, sourceID); err != nil {
		t.Fatal(err)
	}
	request(1, "GET", fmt.Sprintf("/api/posts/%d", mine[0].ID), "", 404)
}
