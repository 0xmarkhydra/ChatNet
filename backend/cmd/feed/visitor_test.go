package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/database"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestVisitorTimelineIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("local test database required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	ids := make([]int64, 2)
	names := make([]string, 2)
	for i := range ids {
		names[i] = fmt.Sprintf("visitor_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!','Visitor') RETURNING id", names[i]+"@example.invalid", names[i]).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", ids[i])
	}
	for _, visibility := range []string{"public", "friends", "private"} {
		if _, err := db.Exec(ctx, "INSERT INTO posts(user_id,content,visibility) VALUES($1,$2::text,$2::text)", ids[0], visibility); err != nil {
			t.Fatal(err)
		}
	}
	token, err := authx.Sign("test", ids[1], names[1], "Visitor")
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	s := &server{db: db}
	mux.Handle("GET /api/posts", authx.Middleware("test", http.HandlerFunc(s.list)))
	call := func(query string, want int) []post {
		t.Helper()
		req := httptest.NewRequest("GET", "/api/posts?author="+names[0]+query, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%d: %s", rec.Code, rec.Body.String())
		}
		var items []post
		if err := json.Unmarshal(rec.Body.Bytes(), &items); err != nil {
			t.Fatal(err)
		}
		return items
	}
	if items := call("", 200); len(items) != 1 || items[0].Visibility != "public" {
		t.Fatalf("stranger scope: %+v", items)
	}
	if _, err := db.Exec(ctx, "INSERT INTO friend_connections(user_low,user_high,requested_by,status) VALUES(LEAST($1::bigint,$2),GREATEST($1::bigint,$2),$1,'accepted')", ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	items := call("&limit=1", 200)
	if len(items) != 1 || items[0].Visibility != "friends" {
		t.Fatalf("first page: %+v", items)
	}
	older := call(fmt.Sprintf("&limit=1&before=%d", items[0].ID), 200)
	if len(older) != 1 || older[0].Visibility != "public" {
		t.Fatalf("cursor scope: %+v", older)
	}
	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	if items := call("", 200); len(items) != 0 {
		t.Fatalf("blocked owner leaked: %+v", items)
	}
	if _, err := db.Exec(ctx, "DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", ids[1], ids[0]); err != nil {
		t.Fatal(err)
	}
	if items := call("", 200); len(items) != 0 {
		t.Fatalf("blocked viewer leaked: %+v", items)
	}
}
