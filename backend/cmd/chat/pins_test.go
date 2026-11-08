package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func TestMessagePinPermissionMatrix(t *testing.T) {
	for _, tc := range []struct {
		typ, role string
		want      bool
	}{
		{"direct", "member", true},
		{"direct", "owner", true},
		{"group", "owner", true},
		{"group", "admin", true},
		{"group", "member", false},
		{"group", "", false},
		{"unknown", "owner", false},
	} {
		if got := canChangeMessagePin(tc.typ, tc.role); got != tc.want {
			t.Errorf("type=%s role=%s got=%v want=%v", tc.typ, tc.role, got, tc.want)
		}
	}
}

func TestChatPinsIntegration(t *testing.T) {
	dbURL, redisAddr := os.Getenv("CHATNET_TEST_DATABASE_URL"), os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if dbURL == "" || redisAddr == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR for integration")
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
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db, redis: rdb, jwtSecret: "pins-integration-secret"}
	suffix := strconv.FormatInt(time.Now().UnixNano(), 10)
	userIDs := []int64{}
	users := []string{}
	for _, label := range []string{"a", "b", "c", "d"} {
		name := "pin" + label + suffix
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.com", name).Scan(&id); err != nil {
			t.Fatal(err)
		}
		userIDs = append(userIDs, id)
		users = append(users, name)
	}
	var directID, groupID, msgID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,created_by) VALUES('direct',$1) RETURNING id`, userIDs[0]).Scan(&directID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by) VALUES('group','Pins QA',$1) RETURNING id`, userIDs[0]).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM conversations WHERE id IN ($1,$2)`, directID, groupID)
		for _, id := range userIDs {
			_, _ = db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, id)
		}
	}()
	for _, id := range userIDs[:2] {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)`, directID, id); err != nil {
			t.Fatal(err)
		}
	}
	for i, role := range []string{"owner", "admin", "member"} {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,$3)`, groupID, userIDs[i], role); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,text)
		VALUES($1,$2,'Shared pin') RETURNING id`, groupID, userIDs[2]).Scan(&msgID); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	for _, route := range []struct {
		pattern string
		fn      http.HandlerFunc
	}{
		{"PUT /api/conversations/{id}/pin", s.setConversationPin},
		{"DELETE /api/conversations/{id}/pin", s.setConversationPin},
		{"GET /api/conversations", s.listConversations},
		{"PUT /api/messages/{id}/pin", s.setMessagePin},
		{"DELETE /api/messages/{id}/pin", s.setMessagePin},
		{"GET /api/conversations/{id}/pins", s.listPinnedMessages},
		{"DELETE /api/messages/{id}", s.deleteMessage},
	} {
		mux.Handle(route.pattern, authx.Middleware(s.jwtSecret, route.fn))
	}
	tokens := make([]string, len(users))
	for i := range users {
		token, err := authx.Sign(s.jwtSecret, userIDs[i], users[i], users[i])
		if err != nil {
			t.Fatal(err)
		}
		tokens[i] = token
	}
	request := func(actor int, method, path string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, req)
		return response
	}
	assert := func(actor int, method, path string, want int) *httptest.ResponseRecorder {
		t.Helper()
		response := request(actor, method, path)
		if response.Code != want {
			t.Fatalf("%s %s actor %d: %d %s", method, path, actor, response.Code, response.Body.String())
		}
		return response
	}
	directPath := fmt.Sprintf("/api/conversations/%d/pin", directID)
	assert(0, "PUT", directPath, 200)
	assert(3, "PUT", directPath, 403)
	for actor, wantPin := range []bool{true, false} {
		response := assert(actor, "GET", fmt.Sprintf("/api/conversations?id=%d", directID), 200)
		var cs []conversation
		if err := json.Unmarshal(response.Body.Bytes(), &cs); err != nil || len(cs) != 1 ||
			(cs[0].PinnedAt != nil) != wantPin {
			t.Fatalf("per-user pinned conversations actor=%d: %s / %v", actor, response.Body.String(), err)
		}
	}
	assert(0, "DELETE", directPath, 200)

	msgPath := fmt.Sprintf("/api/messages/%d/pin", msgID)
	pinsPath := fmt.Sprintf("/api/conversations/%d/pins", groupID)
	// Check that the same SSE signal reaches another member's subscribed device.
	sub := rdb.Subscribe(ctx, userChannel(userIDs[2]))
	defer sub.Close()
	if _, err := sub.Receive(ctx); err != nil {
		t.Fatal(err)
	}
	assert(2, "PUT", msgPath, 403)
	assert(3, "PUT", msgPath, 403)
	assert(0, "PUT", msgPath, 200)
	select {
	case item := <-sub.Channel():
		var event realtimeEvent
		if err := json.Unmarshal([]byte(item.Payload), &event); err != nil ||
			event.Type != "pins.updated" || event.ConversationID != groupID || event.Message != nil {
			t.Fatalf("unexpected SSE pin event: %s / %v", item.Payload, err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("group member did not receive pins.updated")
	}
	assert(0, "PUT", msgPath, 200) // idempotent; no duplicate pin
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM group_admin_audit
		WHERE conversation_id=$1 AND action='message.pinned'`, groupID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("duplicate pin produced duplicate audit: count=%d err=%v", auditCount, err)
	}
	response := assert(2, "GET", pinsPath, 200)
	var pins []pinnedMessage
	if err := json.Unmarshal(response.Body.Bytes(), &pins); err != nil || len(pins) != 1 ||
		pins[0].Message.ID != msgID || pins[0].Message.Text != "Shared pin" {
		t.Fatalf("group member cannot see pin: %s / %v", response.Body.String(), err)
	}
	assert(3, "GET", pinsPath, 403)
	assert(2, "DELETE", msgPath, 403)
	assert(1, "DELETE", msgPath, 200)
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM group_admin_audit
		WHERE conversation_id=$1 AND action='message.unpinned'`, groupID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("missing group unpin audit: count=%d err=%v", auditCount, err)
	}
	response = assert(2, "GET", pinsPath, 200)
	if response.Body.String() != "[]\n" {
		t.Fatalf("unpin did not remove pin: %s", response.Body.String())
	}
	assert(1, "PUT", msgPath, 200)

	// Privacy: a message from someone who blocked the viewer must not appear in pins.
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, userIDs[2], userIDs[0]); err != nil {
		t.Fatal(err)
	}
	response = assert(0, "GET", pinsPath, 200)
	if response.Body.String() != "[]\n" {
		t.Fatalf("blocked sender's pin exposed: %s", response.Body.String())
	}
	assert(0, "PUT", msgPath, 403)
	if _, err := db.Exec(ctx, `DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, userIDs[2], userIDs[0]); err != nil {
		t.Fatal(err)
	}

	assert(2, "DELETE", fmt.Sprintf("/api/messages/%d", msgID), 200)
	var remaining int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM message_pins WHERE message_id=$1`, msgID).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("recall did not clear pin: remaining=%d err=%v", remaining, err)
	}
	response = assert(2, "GET", pinsPath, 200)
	if response.Body.String() != "[]\n" {
		t.Fatalf("recalled message exposed: %s", response.Body.String())
	}
	assert(0, "PUT", msgPath, 409)
	if _, err := db.Exec(ctx, `DELETE FROM conversation_members
		WHERE conversation_id=$1 AND user_id=$2`, groupID, userIDs[1]); err != nil {
		t.Fatal(err)
	}
	assert(1, "GET", pinsPath, 403)
	assert(1, "DELETE", msgPath, 403)
}
