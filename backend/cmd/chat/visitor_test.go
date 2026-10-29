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

func TestVisitorProfileIntegration(t *testing.T) {
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
		names[i] = fmt.Sprintf("vp_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!','Tên có dấu') RETURNING id", names[i]+"@example.invalid", names[i]).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", ids[i])
	}
	token, _ := authx.Sign("test", ids[1], names[1], "Viewer")
	mux := http.NewServeMux()
	mux.Handle("GET /api/users/{username}/profile", authx.Middleware("test", http.HandlerFunc((&server{db: db}).getUserProfile)))
	call := func(auth string, want int) map[string]any {
		req := httptest.NewRequest("GET", "/api/users/"+names[0]+"/profile", nil)
		if auth != "" {
			req.Header.Set("Authorization", "Bearer "+auth)
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%d: %s", rec.Code, rec.Body.String())
		}
		var result map[string]any
		json.Unmarshal(rec.Body.Bytes(), &result)
		return result
	}
	call("", 401)
	result := call(token, 200)
	if result["username"] != names[0] || result["displayName"] != "Tên có dấu" {
		t.Fatalf("wrong identity: %+v", result)
	}
	for _, key := range []string{"email", "phone", "phone_e164", "password_hash", "token", "searchableByEmail"} {
		if _, ok := result[key]; ok {
			t.Fatalf("private field leaked: %s", key)
		}
	}
	for _, pair := range [][2]int64{{ids[0], ids[1]}, {ids[1], ids[0]}} {
		if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", pair[0], pair[1]); err != nil {
			t.Fatal(err)
		}
		call(token, 404)
		db.Exec(ctx, "DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", pair[0], pair[1])
	}
}
