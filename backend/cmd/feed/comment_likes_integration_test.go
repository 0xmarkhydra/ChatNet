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

func TestCommentLikesIntegration(t *testing.T) {
	uri := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("isolated PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	const secret = "test-comment-likes"
	s := &server{db: db, jwtSecret: secret}
	ids := [3]int64{}
	tokens := [3]string{}
	defer func() {
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		for _, id := range ids {
			if id != 0 {
				if _, err := db.Exec(cleanup, "DELETE FROM users WHERE id=$1", id); err != nil {
					t.Errorf("cleanup user: %v", err)
				}
			}
		}
	}()
	for i := range ids {
		name := fmt.Sprintf("comment_like_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		tokens[i], err = authx.Sign(secret, ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	var postID, commentID int64
	if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility)
		VALUES($1,'post','public') RETURNING id`, ids[0]).Scan(&postID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO comments(post_id,user_id,content)
		VALUES($1,$2,'comment') RETURNING id`, postID, ids[2]).Scan(&commentID); err != nil {
		t.Fatal(err)
	}
	request := func(actor int, method string, target int64, want int) post {
		t.Helper()
		req := httptest.NewRequest(method, "/api/posts/test", nil)
		req.SetPathValue("id", fmt.Sprint(target))
		req.SetPathValue("commentId", fmt.Sprint(commentID))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		rec := httptest.NewRecorder()
		handler := s.changeCommentLike
		if method == http.MethodGet {
			handler = s.detailPost
		}
		authx.Middleware(secret, http.HandlerFunc(handler)).ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%s actor %d: status=%d want=%d body=%s", method, actor, rec.Code, want, rec.Body.String())
		}
		var result post
		if want == http.StatusOK {
			if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
		}
		return result
	}
	assertLiked := func(p post, want bool) {
		t.Helper()
		if len(p.Comments) != 1 || p.Comments[0].ID != commentID || p.Comments[0].Liked != want {
			t.Fatalf("expected liked=%t for comment: %+v", want, p.Comments)
		}
	}

	assertLiked(request(1, http.MethodPut, postID, 200), true)
	assertLiked(request(1, http.MethodPut, postID, 200), true)
	assertLiked(request(1, http.MethodGet, postID, 200), true)
	assertLiked(request(0, http.MethodGet, postID, 200), false)
	assertLiked(request(1, http.MethodDelete, postID, 200), false)
	assertLiked(request(1, http.MethodDelete, postID, 200), false)
	assertLiked(request(1, http.MethodGet, postID, 200), false)
	request(1, http.MethodPut, postID+1, 404)

	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", ids[2], ids[1]); err != nil {
		t.Fatal(err)
	}
	request(1, http.MethodPut, postID, 404)
	request(1, http.MethodDelete, postID, 404)
}