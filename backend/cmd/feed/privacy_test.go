package main

import (
	"context"
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

// This is a real PostgreSQL authorization test, not an in-memory handler mock.
// Use a disposable CHATNET_TEST_DATABASE_URL: the test migrates that database.
func TestFeedPrivacyThreeAccountsIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to run the real PostgreSQL privacy test")
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

	secret := "feed-privacy-test-secret"
	ids := make([]int64, 3)
	tokens := make([]string, 3)
	prefix := fmt.Sprintf("feed_privacy_%d", time.Now().UnixNano())
	for i := range ids {
		username := fmt.Sprintf("%s_%d", prefix, i)
		if err := db.QueryRow(ctx,
			"INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!', $2) RETURNING id",
			username+"@example.invalid", username).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign(secret, ids[i], username, username)
		if err != nil {
			t.Fatal(err)
		}
	}

	// A and B are friends; C is unrelated.
	_, err = db.Exec(ctx, `INSERT INTO friend_connections(user_low,user_high,requested_by,status)
        VALUES($1,$2,$1,'accepted')`, ids[0], ids[1])
	if err != nil {
		t.Fatal(err)
	}
	var friendsPost, privatePost int64
	if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility)
        VALUES($1,'friends only','friends') RETURNING id`, ids[0]).Scan(&friendsPost); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility)
        VALUES($1,'owner only','private') RETURNING id`, ids[0]).Scan(&privatePost); err != nil {
		t.Fatal(err)
	}

	s := &server{db: db}
	mux := http.NewServeMux()
	mux.Handle("GET /api/posts/{id}", authx.Middleware(secret, http.HandlerFunc(s.detailPost)))
	mux.Handle("POST /api/posts/{id}/comments", authx.Middleware(secret, http.HandlerFunc(s.addComment)))
	mux.Handle("PATCH /api/posts/{id}/comments/{commentId}", authx.Middleware(secret, http.HandlerFunc(s.editComment)))
	mux.Handle("DELETE /api/posts/{id}/comments/{commentId}", authx.Middleware(secret, http.HandlerFunc(s.deleteComment)))
	mux.Handle("POST /api/posts/{id}/like", authx.Middleware(secret, http.HandlerFunc(s.like)))
	mux.Handle("POST /api/posts/{id}/save", authx.Middleware(secret, http.HandlerFunc(s.toggleSave)))

	request := func(actor int, method, path, body string, want int) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("user %d %s %s: got %d, want %d: %s", actor, method, path, res.Code, want, res.Body.String())
		}
	}
	friendsPath := fmt.Sprintf("/api/posts/%d", friendsPost)
	privatePath := fmt.Sprintf("/api/posts/%d", privatePost)
	request(0, "GET", privatePath, "", 200)
	request(1, "GET", privatePath, "", 404)
	request(2, "GET", privatePath, "", 404)
	request(1, "GET", friendsPath, "", 200)
	request(2, "GET", friendsPath, "", 404)
	request(2, "POST", friendsPath+"/like", "", 404)
	request(2, "POST", friendsPath+"/save", "", 404)
	request(2, "POST", friendsPath+"/comments", `{"content":"should not insert"}`, 404)

	request(1, "POST", friendsPath+"/comments", `{"content":"allowed before unfriend"}`, 201)
	var commentID int64
	if err := db.QueryRow(ctx, `SELECT id FROM comments WHERE post_id=$1 AND user_id=$2`, friendsPost, ids[1]).Scan(&commentID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `DELETE FROM friend_connections WHERE user_low=$1 AND user_high=$2`, ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}

	commentPath := fmt.Sprintf("%s/comments/%d", friendsPath, commentID)
	request(1, "GET", friendsPath, "", 404)
	request(1, "POST", friendsPath+"/comments", `{"content":"not authorized anymore"}`, 404)
	request(1, "PATCH", commentPath, `{"content":"should not edit"}`, 404)
	request(1, "DELETE", commentPath, "", 404)
	var content string
	if err := db.QueryRow(ctx, `SELECT content FROM comments WHERE id=$1`, commentID).Scan(&content); err != nil {
		t.Fatal(err)
	}
	if content != "allowed before unfriend" {
		t.Fatalf("privacy-bypassed comment mutation: %q", content)
	}
}
