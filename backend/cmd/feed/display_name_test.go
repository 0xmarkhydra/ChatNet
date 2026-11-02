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

func TestDisplayNamesFeedIntegration(t *testing.T) {
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
	name := fmt.Sprintf("feed_label_%d", time.Now().UnixNano())
	var uid int64
	if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!','Old label') RETURNING id", name+"@example.invalid", name).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", uid)
	token, err := authx.Sign("test", uid, name, "Old label")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "UPDATE users SET display_name='Lê Minh An' WHERE id=$1", uid); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	mux.Handle("GET /api/stories", authx.Middleware("test", http.HandlerFunc(s.listStories)))
	mux.Handle("POST /api/posts", authx.Middleware("test", http.HandlerFunc(s.create)))
	mux.Handle("GET /api/posts", authx.Middleware("test", http.HandlerFunc(s.list)))
	mux.Handle("GET /api/posts/{id}", authx.Middleware("test", http.HandlerFunc(s.detailPost)))
	mux.Handle("POST /api/posts/{id}/comments", authx.Middleware("test", http.HandlerFunc(s.addComment)))
	call := func(method, path, body string, want int) []byte {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%s %s: %d %s", method, path, rec.Code, rec.Body.String())
		}
		return rec.Body.Bytes()
	}
	var created post
	if err := json.Unmarshal(call("POST", "/api/posts", `{"content":"Bài viết có tên hiển thị"}`, 201), &created); err != nil {
		t.Fatal(err)
	}
	assertAuthor := func(p post, label string) {
		t.Helper()
		if p.Author != name || p.AuthorDisplayName != label {
			t.Fatalf("author must remain username with separate label: %+v", p)
		}
	}
	assertAuthor(created, "Lê Minh An")
	var commented post
	if err := json.Unmarshal(call("POST", fmt.Sprintf("/api/posts/%d/comments", created.ID), `{"content":"Bình luận"}`, 201), &commented); err != nil {
		t.Fatal(err)
	}
	assertAuthor(commented, "Lê Minh An")
	if len(commented.Comments) != 1 || commented.Comments[0].Author != name || commented.Comments[0].AuthorDisplayName != "Lê Minh An" {
		t.Fatalf("comment label: %+v", commented.Comments)
	}
	if _, err := db.Exec(ctx, "UPDATE users SET display_name='Tên đã đổi' WHERE id=$1", uid); err != nil {
		t.Fatal(err)
	}
	var listed []post
	if err := json.Unmarshal(call("GET", "/api/posts?scope=mine", "", 200), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 {
		t.Fatalf("own posts: %+v", listed)
	}
	assertAuthor(listed[0], "Tên đã đổi")
	var detail post
	if err := json.Unmarshal(call("GET", fmt.Sprintf("/api/posts/%d", created.ID), "", 200), &detail); err != nil {
		t.Fatal(err)
	}
	assertAuthor(detail, "Tên đã đổi")
	if detail.Comments[0].AuthorDisplayName != "Tên đã đổi" {
		t.Fatal("comment label was frozen at creation")
	}
	if _, err := db.Exec(ctx, "INSERT INTO stories(user_id,storage_ref,original_name,content_type,size_bytes,kind) VALUES($1,'story/fixture','image.png','image/png',12,'image')", uid); err != nil {
		t.Fatal(err)
	}
	var stories []story
	if err := json.Unmarshal(call("GET", "/api/stories", "", 200), &stories); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, item := range stories {
		if item.Author == name {
			found = true
			if item.AuthorDisplayName != "Tên đã đổi" {
				t.Fatalf("story display label: %+v", item)
			}
		}
	}
	if !found {
		t.Fatal("missing own story")
	}

}
