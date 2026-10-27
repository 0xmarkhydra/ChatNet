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

func TestFeedBlockThreeAccountsIntegration(t *testing.T) {
	uri := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("isolated PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}

	ids := [3]int64{}
	tokens := [3]string{}
	for i := range ids {
		name := fmt.Sprintf("block_feed_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
            VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	posts := [3]int64{}
	for i := range posts {
		if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility)
            VALUES($1,$2,'public') RETURNING id`, ids[i], fmt.Sprintf("post-from-%d", i)).Scan(&posts[i]); err != nil {
			t.Fatal(err)
		}
	}
	// Both A and B comment on C's unrelated, public post.
	for _, i := range []int{0, 1} {
		if _, err := db.Exec(ctx, `INSERT INTO comments(post_id,user_id,content)
             VALUES($1,$2,$3)`, posts[2], ids[i], fmt.Sprintf("comment-from-%d", i)); err != nil {
			t.Fatal(err)
		}
	}
	request := func(actor int, method, path, body string, handler http.HandlerFunc, target int64, want int) string {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		if target > 0 {
			req.SetPathValue("id", fmt.Sprint(target))
		}
		res := httptest.NewRecorder()
		authx.Middleware("test", handler).ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("actor %d %s %s: %d want %d: %s", actor, method, path, res.Code, want, res.Body.String())
		}
		return res.Body.String()
	}
	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ viewer, hidden int }{{0, 1}, {1, 0}} {
		raw := request(tc.viewer, "GET", "/api/posts", "", s.list, 0, 200)
		var listed []post
		if err := json.Unmarshal([]byte(raw), &listed); err != nil {
			t.Fatal(err)
		}
		for _, p := range listed {
			if p.ID == posts[tc.hidden] {
				t.Fatalf("blocked author leaked to %d: %s", tc.viewer, raw)
			}
		}
		if !strings.Contains(raw, "post-from-2") {
			t.Fatalf("third party's post disappeared: %s", raw)
		}
		raw = request(tc.viewer, "GET", "/api/posts/id", "", s.detailPost, posts[2], 200)
		if strings.Contains(raw, fmt.Sprintf("comment-from-%d", tc.hidden)) {
			t.Fatalf("blocked commenter exposed to %d: %s", tc.viewer, raw)
		}
		request(tc.viewer, "GET", "/api/posts/id", "", s.detailPost, posts[tc.hidden], 404)
		request(tc.viewer, "POST", "/api/posts/id/like", "", s.like, posts[tc.hidden], 404)
		request(tc.viewer, "POST", "/api/posts/id/comments", `{"content":"not allowed"}`, s.addComment, posts[tc.hidden], 404)
	}
	raw := request(2, "GET", "/api/posts/id", "", s.detailPost, posts[2], 200)
	if !strings.Contains(raw, "comment-from-0") || !strings.Contains(raw, "comment-from-1") {
		t.Fatalf("C must see both comments: %s", raw)
	}
	raw = request(2, "GET", "/api/posts", "", s.list, 0, 200)
	if !strings.Contains(raw, "post-from-0") || !strings.Contains(raw, "post-from-1") {
		t.Fatalf("C must see both posts: %s", raw)
	}
	if _, err := db.Exec(ctx, "DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	request(0, "GET", "/api/posts/id", "", s.detailPost, posts[1], 200)
}
