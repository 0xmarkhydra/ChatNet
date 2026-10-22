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
	mux.Handle("GET /api/conversations/memberships", mw(s.listConversationMemberships))
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

	// A second conversation allows cursor/limit verification. Both endpoints
	// reveal only the authenticated actor's memberships.
	var otherID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by)
		VALUES('group','Membership cursor test',$1) RETURNING id`, ids[0]).Scan(&otherID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", otherID)
	if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role)
		VALUES($1,$2,'owner')`, otherID, ids[0]); err != nil {
		t.Fatal(err)
	}
	type membershipPage struct {
		IDs       []int64 `json:"ids"`
		NextAfter *int64  `json:"nextAfter"`
	}
	snapshot := func(actor int, suffix string) membershipPage {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/conversations/memberships"+suffix, nil)
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("memberships actor %d: %d %s", actor, rec.Code, rec.Body.String())
		}
		var page membershipPage
		if err := json.Unmarshal(rec.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		return page
	}
	noAuth := httptest.NewRecorder()
	mux.ServeHTTP(noAuth, httptest.NewRequest(http.MethodGet, "/api/conversations/memberships", nil))
	if noAuth.Code != http.StatusUnauthorized {
		t.Fatalf("membership snapshot must require authentication, got %d", noAuth.Code)
	}
	pageOne := snapshot(0, "?limit=1")
	if len(pageOne.IDs) != 1 || pageOne.IDs[0] != groupID || pageOne.NextAfter == nil ||
		*pageOne.NextAfter != groupID {
		t.Fatalf("invalid first membership page: %+v", pageOne)
	}
	pageTwo := snapshot(0, fmt.Sprintf("?limit=1&after=%d", *pageOne.NextAfter))
	if len(pageTwo.IDs) != 1 || pageTwo.IDs[0] != otherID || pageTwo.NextAfter != nil {
		t.Fatalf("invalid second membership page: %+v", pageTwo)
	}
	if page := snapshot(2, ""); len(page.IDs) != 1 || page.IDs[0] != groupID {
		t.Fatalf("account 2 must see only its own group: %+v", page)
	}
	req(2, "GET", "/api/conversations/memberships?limit=501", "", 400)
	req(2, "GET", "/api/conversations/memberships?after=-1", "", 400)
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
	if page := snapshot(2, ""); len(page.IDs) != 0 || page.NextAfter != nil {
		t.Fatalf("kicked account retained membership snapshot: %+v", page)
	}
	req(2, "PATCH", base, `{"name":"kicked"}`, 403)
	// A later re-invitation must appear in the next authoritative snapshot.
	req(1, "POST", base+"/members", fmt.Sprintf(`{"usernames":["%s_2"]}`, prefix), 200)
	if page := snapshot(2, ""); len(page.IDs) != 1 || page.IDs[0] != groupID {
		t.Fatalf("re-invited user missing from membership snapshot: %+v", page)
	}
	req(1, "DELETE", memberPath(ids[2]), "", 200)
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
