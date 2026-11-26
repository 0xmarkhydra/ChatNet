package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestStoryViewsIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}

	// 0 owns the story; 1 views, 2 only reacts, 3 views and is then blocked.
	var users [4]int64
	defer func() {
		for _, id := range users {
			if id != 0 {
				_, _ = db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
			}
		}
	}()
	var tokens [4]string
	prefix := fmt.Sprintf("story_view_%d", time.Now().UnixNano())
	for i := range users {
		name := fmt.Sprintf("%s_%d", prefix, i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		if tokens[i], err = authx.Sign("test", users[i], name, name); err != nil {
			t.Fatal(err)
		}
	}

	s := &server{db: db}
	mux := http.NewServeMux()
	for pattern, handler := range map[string]http.HandlerFunc{
		"PUT /api/stories/{id}/view":  s.recordStoryView,
		"GET /api/stories/{id}/views": s.listStoryViews,
		"PUT /api/stories/{id}/like":  s.changeStoryLike,
	} {
		mux.Handle(pattern, authx.Middleware("test", handler))
	}
	call := func(actor int, method, path string, want int) []byte {
		t.Helper()
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("%s %s: got %d, want %d (%s)", method, path, res.Code, want, res.Body.String())
		}
		return res.Body.Bytes()
	}
	var id int64
	if err := db.QueryRow(ctx, `INSERT INTO stories(user_id, kind, text_content, text_background)
		VALUES($1,'text','Lượt xem','berry') RETURNING id`, users[0]).Scan(&id); err != nil {
		t.Fatal(err)
	}
	viewPath := fmt.Sprintf("/api/stories/%d/view", id)
	listPath := viewPath + "s"
	type page struct {
		Total   int
		Viewers []storyViewer
		Next    int64
	}
	list := func(query string) page {
		t.Helper()
		var result page
		if err := json.Unmarshal(call(0, "GET", listPath+query, 200), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}

	if got := list(""); got.Total != 0 || got.Viewers == nil || len(got.Viewers) != 0 {
		t.Fatalf("new story: %+v", got)
	}
	call(0, "PUT", viewPath, 404) // the owner is not a viewer
	call(1, "PUT", viewPath, 204)
	first := list("")
	call(1, "PUT", viewPath, 204)
	if got := list(""); got.Total != 1 || len(got.Viewers) != 1 || got.Viewers[0].ID != users[1] ||
		got.Viewers[0].Emoji != "" || got.Viewers[0].ViewedAt == nil || !got.Viewers[0].ViewedAt.Equal(*first.Viewers[0].ViewedAt) {
		t.Fatalf("repeat view must keep one row and the first time: %+v", got)
	}
	call(1, "GET", listPath, 404) // viewers cannot read the audience

	call(1, "PUT", fmt.Sprintf("/api/stories/%d/like", id), 204)
	call(2, "PUT", fmt.Sprintf("/api/stories/%d/like", id), 204)
	call(3, "PUT", viewPath, 204)
	got := list("")
	if got.Total != 3 || len(got.Viewers) != 3 || got.Viewers[0].Emoji != "❤️" ||
		got.Viewers[1].ID != users[2] || got.Viewers[1].ViewedAt != nil || got.Viewers[2].Emoji != "" {
		t.Fatalf("audience should merge views and reactions once: %+v", got)
	}
	if after := list(fmt.Sprintf("?after=%d", users[2])); after.Total != 3 || len(after.Viewers) != 1 || after.Viewers[0].ID != users[3] {
		t.Fatalf("cursor: %+v", after)
	}
	call(0, "GET", listPath+"?after=abc", 400)

	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", users[3], users[0]); err != nil {
		t.Fatal(err)
	}
	if got := list(""); got.Total != 2 || len(got.Viewers) != 2 {
		t.Fatalf("blocked viewer must disappear from count and list: %+v", got)
	}
	call(3, "PUT", viewPath, 404)

	// The other direction, against someone who only reacted.
	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", users[0], users[2]); err != nil {
		t.Fatal(err)
	}
	if got := list(""); got.Total != 1 || len(got.Viewers) != 1 || got.Viewers[0].ID != users[1] {
		t.Fatalf("owner-blocked reactor must disappear: %+v", got)
	}
	call(2, "PUT", viewPath, 404)

	if _, err := db.Exec(ctx, "UPDATE stories SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	call(1, "PUT", viewPath, 404)
	call(0, "GET", listPath, 404)
	if _, err := db.Exec(ctx, "DELETE FROM stories WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	var left int
	if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM story_views WHERE story_id=$1", id).Scan(&left); err != nil || left != 0 {
		t.Fatalf("views must be removed with the story: %d, %v", left, err)
	}
}
