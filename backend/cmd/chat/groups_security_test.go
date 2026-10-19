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
	"chatnet/internal/onesignalx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Exercise real PostgreSQL roles and Redis-backed event handling with three
// distinct JWT identities. No mock authorization or in-memory group storage.
func TestGroupRolesThreeAccountsIntegration(t *testing.T) {
	dbURL, redisAddress := os.Getenv("CHATNET_TEST_DATABASE_URL"), os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if dbURL == "" || redisAddress == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR to verify real group permissions")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: redisAddress})
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatal(err)
	}

	secret := "group-permission-test-secret"
	ids := make([]int64, 3)
	tokens := make([]string, 3)
	prefix := fmt.Sprintf("group_permission_%d", time.Now().UnixNano())
	for i := range ids {
		username := fmt.Sprintf("%s_%d", prefix, i)
		err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
           VALUES($1,$2,'!',$2) RETURNING id`, username+"@example.invalid", username).Scan(&ids[i])
		if err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, ids[i])
		tokens[i], err = authx.Sign(secret, ids[i], username, username)
		if err != nil {
			t.Fatal(err)
		}
	}
	var groupID int64
	err = db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by) VALUES('group','Permission test',$1) RETURNING id`, ids[0]).Scan(&groupID)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM conversations WHERE id=$1`, groupID)
	for i, role := range []string{"owner", "admin", "member"} {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,$3)`, groupID, ids[i], role); err != nil {
			t.Fatal(err)
		}
	}

	s := &server{db: db, redis: rdb, push: onesignalx.New("", "")}
	mux := http.NewServeMux()
	mw := func(fn http.HandlerFunc) http.Handler { return authx.Middleware(secret, fn) }
	mux.Handle("PATCH /api/conversations/{id}", mw(s.updateGroup))
	mux.Handle("GET /api/conversations/{id}/members", mw(s.listGroupMembers))
	mux.Handle("POST /api/conversations/{id}/members", mw(s.addGroupMembers))
	mux.Handle("PATCH /api/conversations/{id}/members/{userId}", mw(s.updateGroupMemberRole))
	mux.Handle("DELETE /api/conversations/{id}/members/{userId}", mw(s.removeGroupMember))
	base := fmt.Sprintf("/api/conversations/%d", groupID)
	memberPath := func(id int64) string { return fmt.Sprintf("%s/members/%d", base, id) }
	req := func(actor int, method, path, body string, want int) {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+tokens[actor])
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, r)
		if res.Code != want {
			t.Fatalf("actor %d %s %s: %d want %d: %s", actor, method, path, res.Code, want, res.Body.String())
		}
	}

	req(2, "GET", base+"/members", "", 200)
	req(2, "PATCH", base, `{"name":"forbidden"}`, 403)
	req(2, "POST", base+"/members", `{"usernames":["nonexistent"]}`, 403)
	req(2, "PATCH", memberPath(ids[1]), `{"role":"owner"}`, 403)
	req(2, "DELETE", memberPath(ids[1]), "", 403)
	req(1, "PATCH", base, `{"name":"Admin rename"}`, 200)
	req(0, "DELETE", memberPath(ids[0]), "", 409)
	req(1, "PATCH", memberPath(ids[2]), `{"role":"admin"}`, 403)
	req(0, "PATCH", memberPath(ids[1]), `{"role":"owner"}`, 200)
	req(0, "PATCH", memberPath(ids[2]), `{"role":"admin"}`, 403)
	req(1, "PATCH", memberPath(ids[2]), `{"role":"admin"}`, 200)
	req(0, "DELETE", memberPath(ids[2]), "", 403)
	// Subscribe before the kick, as a connected browser would.
	removedEvents := rdb.Subscribe(ctx, userChannel(ids[2]))
	defer removedEvents.Close()
	if _, err := removedEvents.Receive(ctx); err != nil {
		t.Fatal(err)
	}
	req(1, "DELETE", memberPath(ids[2]), "", 200)
	select {
	case message := <-removedEvents.Channel():
		if message == nil {
			t.Fatal("kicked member event subscription closed")
		}
		var event realtimeEvent
		if err := json.Unmarshal([]byte(message.Payload), &event); err != nil {
			t.Fatal(err)
		}
		if event.Type != "conversation.removed" || event.ConversationID != groupID {
			t.Fatalf("expected conversation.removed for group %d, got %+v", groupID, event)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("kicked member did not receive realtime removal event")
	}
	req(2, "GET", base+"/members", "", 403)
	req(2, "PATCH", base, `{"name":"kicked"}`, 403)
	req(0, "DELETE", memberPath(ids[0]), "", 200)
	req(0, "GET", base+"/members", "", 403)
	req(1, "DELETE", memberPath(ids[1]), "", 409)

	var owners int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM conversation_members WHERE conversation_id=$1 AND role='owner'`, groupID).Scan(&owners); err != nil {
		t.Fatal(err)
	}
	if owners != 1 {
		t.Fatalf("wanted exactly one owner, found %d", owners)
	}
}
