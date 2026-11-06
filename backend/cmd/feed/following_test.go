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

// Run with CHATNET_TEST_DATABASE_URL against a disposable PostgreSQL database.
func TestFollowingFeedShowsOnlyOwnAndAcceptedFriendsIntegration(t *testing.T) {
	dsn := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	userIDs := make([]int64, 3)
	names := make([]string, 3)
	prefix := fmt.Sprintf("follow_%d", time.Now().UnixNano())
	for i := range userIDs {
		names[i] = fmt.Sprintf("%s_%d", prefix, i)
		err := pool.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'test',$2) RETURNING id",
			names[i]+"@example.invalid", names[i]).Scan(&userIDs[i])
		if err != nil {
			t.Fatal(err)
		}
		id := userIDs[i]
		defer pool.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO friend_connections(user_low,user_high,requested_by,status)
    VALUES(LEAST($1::bigint,$2::bigint),GREATEST($1::bigint,$2::bigint),$1,'accepted')`,
		userIDs[0], userIDs[1]); err != nil {
		t.Fatal(err)
	}
	for i, visibility := range []string{"private", "friends", "public"} {
		if _, err := pool.Exec(ctx, "INSERT INTO posts(user_id,content,visibility) VALUES($1,$2,$3)", userIDs[i],
			fmt.Sprintf("following fixture %d", i), visibility); err != nil {
			t.Fatal(err)
		}
	}
	token, err := authx.Sign("test", userIDs[0], names[0], names[0])
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.Handle("GET /api/posts", authx.Middleware("test", http.HandlerFunc((&server{db: pool}).list)))
	req := httptest.NewRequest(http.MethodGet, "/api/posts?scope=following&limit=15", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("following scope status=%d, body=%s", rec.Code, rec.Body.String())
	}
	var results []post
	if err := json.Unmarshal(rec.Body.Bytes(), &results); err != nil {
		t.Fatal(err)
	}
	found := map[string]bool{}
	for _, post := range results {
		found[post.Author] = true
	}
	if !found[names[0]] || !found[names[1]] || found[names[2]] {
		t.Fatalf("following feed should contain own + friend, not unrelated public authors: %v", found)
	}
}
