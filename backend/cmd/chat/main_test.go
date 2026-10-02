package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func TestUserSearchIntegration(t *testing.T) {
	dbURL, redisAddr := os.Getenv("CHATNET_TEST_DATABASE_URL"), os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if dbURL == "" || redisAddr == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR for integration tests")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	defer rdb.Close()
	s := &server{db: db, redis: rdb}
	username := fmt.Sprintf("search_%d", time.Now().UnixNano())
	email := username + "@example.com"
	displayName := "NameOnly" + username
	var id int64
	if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
		VALUES($1,$2,'!',$3) RETURNING id`, email, username, displayName).Scan(&id); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", id)
	token, err := authx.Sign("test", 0, "viewer", "Viewer")
	if err != nil {
		t.Fatal(err)
	}
	handler := authx.Middleware("test", http.HandlerFunc(s.searchUsers))
	for _, tc := range []struct {
		query  string
		found  bool
		status int
	}{
		{strings.ToUpper(email), true, 200},
		{"@" + strings.ToUpper(username), true, 200},
		{username[3:], true, 200},
		{displayName, false, 200},
		{"%", false, 200},
		{username + "%", false, 200},
		{username[6:], true, 200},
		{strings.ReplaceAll(username, "_", "%"), false, 200},
		{"@example.com", false, 200},
		{"@", false, 200},
		{strings.Repeat("a", 255), false, 400},
	} {
		r := httptest.NewRequest(http.MethodGet, "/api/users/search?q="+url.QueryEscape(tc.query), nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%q: %d %s", tc.query, w.Code, w.Body.String())
		}
		if tc.status != http.StatusOK {
			continue
		}
		var results []struct {
			ID    int64
			Email string
		}
		if err := json.Unmarshal(w.Body.Bytes(), &results); err != nil {
			t.Fatal(err)
		}
		found := false
		for _, result := range results {
			found = found || result.ID == id
			if result.Email != "" {
				t.Fatal("search exposed email")
			}
		}
		if found != tc.found {
			t.Fatalf("%q: found=%v want=%v", tc.query, found, tc.found)
		}
	}
	ownToken, err := authx.Sign("test", id, username, displayName)
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodGet, "/api/users/search?q="+url.QueryEscape(email), nil)
	r.Header.Set("Authorization", "Bearer "+ownToken)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatal("search included self")
	}
}

func TestDirectKeyIsOrderIndependent(t *testing.T) {
	if got, want := directKey(9, 2), "2:9"; got != want {
		t.Fatalf("directKey(9,2)=%q want %q", got, want)
	}
	if directKey(2, 9) != directKey(9, 2) {
		t.Fatal("directKey must be order independent")
	}
}
