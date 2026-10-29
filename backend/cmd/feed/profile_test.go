package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestProfileTimelineInvalidScope(t *testing.T) {
	for _, scope := range []string{"all", "other", "mine OR true"} {
		w := httptest.NewRecorder()
		(&server{}).list(w, httptest.NewRequest(http.MethodGet, "/api/posts?scope="+url.QueryEscape(scope), nil))
		if w.Code != http.StatusBadRequest {
			t.Fatalf("scope %q: got %d", scope, w.Code)
		}
	}
}

func TestProfileTimelineOwnershipAndPagingIntegration(t *testing.T) {
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

	prefix := fmt.Sprintf("profile_%d", time.Now().UnixNano())
	ids := make([]int64, 2)
	tokens := make([]string, 2)
	for i := range ids {
		username := fmt.Sprintf("%s_%d", prefix, i)
		if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'test',$2) RETURNING id", username+"@example.invalid", username).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], username, username)
		if err != nil {
			t.Fatal(err)
		}
	}
	ownIDs := []int64{}
	for _, visibility := range []string{"public", "friends", "private"} {
		var id int64
		if err := db.QueryRow(ctx, "INSERT INTO posts(user_id,content,visibility) VALUES($1,'own post',$2) RETURNING id", ids[0], visibility).Scan(&id); err != nil {
			t.Fatal(err)
		}
		ownIDs = append(ownIDs, id)
		// Interleaving another author's public posts must not consume a page slot.
		if _, err := db.Exec(ctx, "INSERT INTO posts(user_id,content,visibility) VALUES($1,'other post','public')", ids[1]); err != nil {
			t.Fatal(err)
		}
	}
	mux := http.NewServeMux()
	mux.Handle("GET /api/posts", authx.Middleware("test", http.HandlerFunc((&server{db: db}).list)))
	call := func(token, query string, want int) []post {
		t.Helper()
		r := httptest.NewRequest(http.MethodGet, "/api/posts?scope=mine&limit=2"+query, nil)
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("got %d want %d: %s", w.Code, want, w.Body.String())
		}
		if want != http.StatusOK {
			return nil
		}
		var posts []post
		if err := json.Unmarshal(w.Body.Bytes(), &posts); err != nil {
			t.Fatal(err)
		}
		return posts
	}
	call("", "", http.StatusUnauthorized)
	first := call(tokens[0], "", http.StatusOK)
	if len(first) != 2 || first[0].ID != ownIDs[2] || first[1].ID != ownIDs[1] || first[0].Visibility != "private" {
		t.Fatalf("incorrect first page: %+v", first)
	}
	second := call(tokens[0], fmt.Sprintf("&before=%d", first[1].ID), http.StatusOK)
	if len(second) != 1 || second[0].ID != ownIDs[0] {
		t.Fatalf("incorrect second page: %+v", second)
	}
	for _, p := range call(tokens[1], "", http.StatusOK) {
		if p.Author != prefix+"_1" {
			t.Fatalf("another account leaked into own timeline: %+v", p)
		}
	}
}
