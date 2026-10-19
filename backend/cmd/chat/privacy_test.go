package main

import (
	"bytes"
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
	"github.com/redis/go-redis/v9"
)

func TestPrivacyIntegration(t *testing.T) {
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
	ids := make([]int64, 2)
	names := make([]string, 2)
	emails := make([]string, 2)
	tokens := make([]string, 2)
	for i := range ids {
		names[i] = fmt.Sprintf("privacy_%d_%d", time.Now().UnixNano(), i)
		emails[i] = names[i] + "@example.com"
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
            VALUES($1,$2,'!',$2) RETURNING id`, emails[i], names[i]).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], names[i], names[i])
		if err != nil {
			t.Fatal(err)
		}
	}
	call := func(actor int, method, endpoint string, handler http.HandlerFunc, body []byte, targetID int64) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(method, endpoint, bytes.NewReader(body))
		request.Header.Set("Authorization", "Bearer "+tokens[actor])
		if targetID != 0 {
			request.SetPathValue("id", fmt.Sprint(targetID))
		}
		recorder := httptest.NewRecorder()
		authx.Middleware("test", handler).ServeHTTP(recorder, request)
		return recorder
	}
	edit := func(visibility userPrivacy) {
		t.Helper()
		body, err := json.Marshal(visibility)
		if err != nil {
			t.Fatal(err)
		}
		res := call(1, "PUT", "/api/privacy", s.updatePrivacy, body, 0)
		if res.Code != 200 {
			t.Fatalf("update privacy: %d %s", res.Code, res.Body.String())
		}
	}
	privacy := userPrivacy{SearchableByUsername: false, SearchableByName: false, SearchableByEmail: false, AllowFriendRequests: false, ShowOnlineStatus: false}
	edit(privacy)
	res := call(1, "GET", "/api/privacy", s.getPrivacy, nil, 0)
	var saved userPrivacy
	if res.Code != 200 || json.Unmarshal(res.Body.Bytes(), &saved) != nil || saved != privacy {
		t.Fatalf("privacy settings not persisted: %d %s", res.Code, res.Body.String())
	}
	if got := res.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("privacy caching enabled: %s", got)
	}
	if err := rdb.Set(ctx, presenceKey(ids[1]), "online", time.Minute).Err(); err != nil {
		t.Fatal(err)
	}
	defer rdb.Del(ctx, presenceKey(ids[1]))
	search := func(query string) []map[string]any {
		t.Helper()
		res := call(0, "GET", "/api/users/search?q="+url.QueryEscape(query), s.searchUsers, nil, 0)
		if res.Code != 200 {
			t.Fatalf("search status=%d %s", res.Code, res.Body.String())
		}
		var users []map[string]any
		if err := json.Unmarshal(res.Body.Bytes(), &users); err != nil {
			t.Fatal(err)
		}
		return users
	}
	if users := search(names[1]); len(users) != 0 {
		t.Fatalf("hidden user leaked via username: %+v", users)
	}
	if users := search(emails[1]); len(users) != 0 {
		t.Fatalf("hidden user leaked via email: %+v", users)
	}
	res = call(0, "POST", "/api/friends/test", s.sendFriendRequest, nil, ids[1])
	if res.Code != http.StatusForbidden {
		t.Fatalf("disabled invites bypass: %d %s", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM friend_connections WHERE user_low=LEAST($1::bigint,$2::bigint) AND user_high=GREATEST($1::bigint,$2::bigint)", ids[0], ids[1]).Scan(&count); err != nil || count != 0 {
		t.Fatalf("blocked invite inserted relation: %d %v", count, err)
	}
	privacy.SearchableByUsername = true
	privacy.SearchableByEmail = true
	privacy.AllowFriendRequests = true
	edit(privacy)
	matches := search(emails[1])
	if len(matches) != 1 || matches[0]["online"] != false {
		t.Fatalf("email exact match or presence privacy failed: %+v", matches)
	}
	if _, ok := matches[0]["email"]; ok {
		t.Fatal("email address disclosed in search result")
	}
	res = call(0, "POST", "/api/friends/test", s.sendFriendRequest, nil, ids[1])
	if res.Code != 200 {
		t.Fatalf("allowed friend invite failed: %d %s", res.Code, res.Body.String())
	}
	res = call(1, "POST", "/api/friends/test/accept", s.acceptFriendRequest, nil, ids[0])
	if res.Code != 200 {
		t.Fatalf("accepted friend invite failed: %d %s", res.Code, res.Body.String())
	}
	res = call(0, "GET", "/api/friends", s.listFriends, nil, 0)
	var friends []friendConnection
	if res.Code != 200 || json.Unmarshal(res.Body.Bytes(), &friends) != nil || len(friends) != 1 || friends[0].Online {
		t.Fatalf("accepted friends leaked presence: %d %s", res.Code, res.Body.String())
	}
	privacy.ShowOnlineStatus = true
	edit(privacy)
	res = call(0, "GET", "/api/friends", s.listFriends, nil, 0)
	if json.Unmarshal(res.Body.Bytes(), &friends) != nil || len(friends) != 1 || !friends[0].Online {
		t.Fatalf("friend presence not enabled after opt-in: %d %s", res.Code, res.Body.String())
	}
}
