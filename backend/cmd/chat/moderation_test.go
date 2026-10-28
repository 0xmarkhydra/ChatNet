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

func TestBlockReportAndFriendQuotaIntegration(t *testing.T) {
	if os.Getenv("CHATNET_TEST_DATABASE_URL") == "" || os.Getenv("CHATNET_TEST_REDIS_ADDR") == "" {
		t.Skip("isolated CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, os.Getenv("CHATNET_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: os.Getenv("CHATNET_TEST_REDIS_ADDR")})
	defer rdb.Close()
	s := &server{db: db, redis: rdb}
	ids := make([]int64, 2)
	names := make([]string, 2)
	tokens := make([]string, 2)
	for i := range ids {
		names[i] = fmt.Sprintf("moderation_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, names[i]+"@example.com", names[i]).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], names[i], names[i])
		if err != nil {
			t.Fatal(err)
		}
	}
	call := func(actor int, method, path string, handler http.HandlerFunc, body string, target int64, want int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+tokens[actor])
		if target > 0 {
			r.SetPathValue("id", fmt.Sprint(target))
		}
		w := httptest.NewRecorder()
		authx.Middleware("test", handler).ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, want, w.Body.String())
		}
		return w
	}
	// Establish direct contact before blocking. An existing direct must not
	// bypass block policy, even for historical conversations.
	w := call(0, "POST", "/api/conversations/direct", s.createDirect, fmt.Sprintf(`{"username":%q}`, names[1]), 0, 201)
	var direct conversation
	if err := json.Unmarshal(w.Body.Bytes(), &direct); err != nil || direct.ID == 0 {
		t.Fatalf("direct=%s err=%v", w.Body.String(), err)
	}
	call(0, "POST", "/api/friends/request", s.sendFriendRequest, "", ids[1], 200)
	call(1, "POST", "/api/users/1/block", s.blockUser, "", ids[0], 200)
	call(1, "POST", "/api/users/1/block", s.blockUser, "", ids[0], 200)
	call(0, "POST", "/api/friends/request", s.sendFriendRequest, "", ids[1], 403)
	call(0, "POST", "/api/conversations/direct", s.createDirect, fmt.Sprintf(`{"username":%q}`, names[1]), 0, 403)
	call(0, "GET", "/api/conversations", s.listConversations, "", 0, 200)
	w = call(0, "GET", "/api/conversations", s.listConversations, "", 0, 200)
	var convs []conversation
	if json.Unmarshal(w.Body.Bytes(), &convs) != nil || len(convs) != 0 {
		t.Fatalf("blocked direct leaked in list: %s", w.Body.String())
	}
	w = httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/api/conversations/test/messages", nil)
	r.SetPathValue("id", fmt.Sprint(direct.ID))
	r.Header.Set("Authorization", "Bearer "+tokens[0])
	authx.Middleware("test", http.HandlerFunc(s.listMessages)).ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("blocked direct messages exposed: %d %s", w.Code, w.Body.String())
	}
	r = httptest.NewRequest("GET", "/api/conversations/test/shared?kind=links", nil)
	r.SetPathValue("id", fmt.Sprint(direct.ID))
	r.Header.Set("Authorization", "Bearer "+tokens[0])
	w = httptest.NewRecorder()
	authx.Middleware("test", http.HandlerFunc(s.listSharedContent)).ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("blocked shared media exposed: %d %s", w.Code, w.Body.String())
	}
	r = httptest.NewRequest("POST", "/api/conversations/test/messages", strings.NewReader(`{"text":"hello"}`))
	r.SetPathValue("id", fmt.Sprint(direct.ID))
	r.Header.Set("Authorization", "Bearer "+tokens[0])
	w = httptest.NewRecorder()
	authx.Middleware("test", http.HandlerFunc(s.createMessage)).ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("blocked direct message accepted: %d %s", w.Code, w.Body.String())
	}
	if got := call(0, "GET", "/api/users/search?q="+url.QueryEscape(names[1]), s.searchUsers, "", 0, 200); strings.Contains(got.Body.String(), names[1]) {
		t.Fatalf("blocked user leaked in search: %s", got.Body.String())
	}
	w = call(1, "GET", "/api/users/blocked", s.listBlockedUsers, "", 0, 200)
	if !strings.Contains(w.Body.String(), names[0]) {
		t.Fatalf("block list missing user: %s", w.Body.String())
	}
	call(1, "DELETE", "/api/users/1/block", s.unblockUser, "", ids[0], 200)
	w = call(0, "POST", "/api/conversations/direct", s.createDirect, fmt.Sprintf(`{"username":%q}`, names[1]), 0, 201)
	var reopened conversation
	if json.Unmarshal(w.Body.Bytes(), &reopened) != nil || reopened.ID != direct.ID {
		t.Fatalf("unblock lost direct: %s", w.Body.String())
	}
	call(0, "POST", "/api/users/1/report", s.reportUser, `{"reason":"bad"}`, ids[1], 400)
	call(0, "POST", "/api/users/1/report", s.reportUser, `{"reason":"spam"} {}`, ids[1], 400)
	call(0, "POST", "/api/users/1/report", s.reportUser, `{"reason":"spam"}`, ids[0], 400)
	for i := 0; i < maxDailyUserReports; i++ {
		call(0, "POST", "/api/users/1/report", s.reportUser, `{"reason":"spam","details":"test"}`, ids[1], 201)
	}
	call(0, "POST", "/api/users/1/report", s.reportUser, `{"reason":"spam"}`, ids[1], 429)
	// Exhaust friend quota across distinct recipients. Canceled relationships
	// are still counted by the immutable request-events ledger.
	var count int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM friend_request_events WHERE sender_id=$1`, ids[0]).Scan(&count); err != nil {
		t.Fatal(err)
	}
	for i := count; i < maxDailyFriendRequests; i++ {
		name := fmt.Sprintf("quota_%d_%d", time.Now().UnixNano(), i)
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,display_name,password_hash)
			VALUES($1,$2,$2,'!') RETURNING id`, name+"@example.com", name).Scan(&id); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", id)
		call(0, "POST", "/api/friends/request", s.sendFriendRequest, "", id, 200)
	}
	call(0, "POST", "/api/friends/request", s.sendFriendRequest, "", ids[1], 429)
	// Existing pending requests stay idempotent even after the quota is reached.
	var existingRecipient int64
	err = db.QueryRow(ctx, `SELECT recipient_id FROM friend_request_events
		WHERE sender_id=$1 ORDER BY id DESC LIMIT 1`, ids[0]).Scan(&existingRecipient)
	if err != nil {
		t.Fatal(err)
	}
	call(0, "POST", "/api/friends/request", s.sendFriendRequest, "", existingRecipient, 200)
}
