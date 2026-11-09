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

func TestPostReactionsLocalIntegration(t *testing.T) {
	if os.Getenv("CHATNET_REACTIONS_LOCAL_TEST") != "1" {
		t.Skip("opt-in PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, "postgres://chatnet:chatnet@127.0.0.1:5432/chatnet?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db, jwtSecret: "test-post-reactions"}
	ids := make([]int64, 3)
	tokens := make([]string, 3)
	for i := range ids {
		name := fmt.Sprintf("postreact_%d_%d", time.Now().UnixNano(), i)
		if err = db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
   VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		tokens[i], err = authx.Sign(s.jwtSecret, ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	var postID int64
	if err = db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility) VALUES($1,'reaction fixture','public') RETURNING id`, ids[0]).Scan(&postID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if _, err := db.Exec(cleanup, `DELETE FROM posts WHERE id=$1`, postID); err != nil {
			t.Errorf("cleanup post: %v", err)
		}
		for _, id := range ids {
			if _, err := db.Exec(cleanup, `DELETE FROM users WHERE id=$1`, id); err != nil {
				t.Errorf("cleanup user: %v", err)
			}
		}
	})
	call := func(actor int, method, emoji string, want int) post {
		t.Helper()
		path := fmt.Sprintf("/api/posts/%d/%s", postID, method)
		body := ""
		if method == "reactions" {
			body = fmt.Sprintf(`{"emoji":%q}`, emoji)
		}
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		req.SetPathValue("id", fmt.Sprint(postID))
		recorder := httptest.NewRecorder()
		handler := s.like
		if method == "reactions" {
			handler = s.react
		}
		authx.Middleware(s.jwtSecret, http.HandlerFunc(handler)).ServeHTTP(recorder, req)
		if recorder.Code != want {
			t.Fatalf("%s %s actor%d: status=%d want=%d body=%s", method, emoji, actor, recorder.Code, want, recorder.Body.String())
		}
		var result post
		if want == 200 {
			if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
		}
		return result
	}
	p := call(1, "like", "", 200)
	if p.Likes != 1 || !p.Liked || p.MyReaction != "👍" {
		t.Fatalf("like: %+v", p)
	}
	p = call(1, "reactions", "❤️", 200)
	if p.Likes != 1 || !p.Liked || p.MyReaction != "❤️" || len(p.Reactions) != 1 {
		t.Fatalf("like->love: %+v", p)
	}
	p = call(2, "reactions", "😂", 200)
	if p.Likes != 2 || len(p.Reactions) != 2 {
		t.Fatalf("peer haha: %+v", p)
	}
	p = call(1, "reactions", "😮", 200)
	if p.Likes != 2 || p.MyReaction != "😮" {
		t.Fatalf("love->wow: %+v", p)
	}
	p = call(1, "reactions", "😢", 200)
	if p.Likes != 2 || p.MyReaction != "😢" {
		t.Fatalf("wow->sad: %+v", p)
	}
	p = call(1, "reactions", "😡", 200)
	if p.Likes != 2 || p.MyReaction != "😡" {
		t.Fatalf("sad->angry: %+v", p)
	}
	p = call(1, "reactions", "😡", 200)
	if p.Likes != 1 || p.Liked || p.MyReaction != "" {
		t.Fatalf("angry toggle off: %+v", p)
	}
	p = call(1, "like", "", 200)
	if p.Likes != 2 || p.MyReaction != "👍" {
		t.Fatalf("legacy like: %+v", p)
	}
	p = call(1, "like", "", 200)
	if p.Likes != 1 || p.Liked {
		t.Fatalf("legacy unlike: %+v", p)
	}
	call(1, "reactions", "🦄", 400)
	if _, err := db.Exec(ctx, `UPDATE posts SET visibility='private' WHERE id=$1`, postID); err != nil {
		t.Fatal(err)
	}
	call(1, "reactions", "❤️", 404)
}
