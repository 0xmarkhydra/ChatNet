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
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Verifies database, HTTP responses, previews, paging and push/realtime audience
// use the same A<->B policy without altering what unrelated member C can see.
func TestBlockedGroupVisibilityThreeAccountsIntegration(t *testing.T) {
	if os.Getenv("CHATNET_TEST_DATABASE_URL") == "" || os.Getenv("CHATNET_TEST_REDIS_ADDR") == "" {
		t.Skip("isolated PostgreSQL and Redis test services required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, os.Getenv("CHATNET_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: os.Getenv("CHATNET_TEST_REDIS_ADDR")})
	defer rdb.Close()
	s := &server{db: db, redis: rdb}

	var ids [3]int64
	var tokens [3]string
	for i := range ids {
		name := fmt.Sprintf("group_block_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
           VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	var groupID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by)
        VALUES('group','three people',$1) RETURNING id`, ids[0]).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", groupID)
	for i, id := range ids {
		role := "member"
		if i == 0 {
			role = "owner"
		}
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role)
             VALUES($1,$2,$3)`, groupID, id, role); err != nil {
			t.Fatal(err)
		}
	}
	messageIDs := make([]int64, 3)
	for i, body := range []string{"A says hello", "C says hello", "https://example.test/B-secret"} {
		sender := []int{0, 2, 1}[i]
		if err := db.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,text)
          VALUES($1,$2,$3) RETURNING id`, groupID, ids[sender], body).Scan(&messageIDs[i]); err != nil {
			t.Fatal(err)
		}
	}

	request := func(actor int, method, path string, handler http.HandlerFunc, target int64, body string, want int) string {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		if target > 0 {
			req.SetPathValue("id", fmt.Sprint(target))
		}
		res := httptest.NewRecorder()
		authx.Middleware("test", handler).ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("%s %s for %d: status %d want %d: %s", method, path, actor, res.Code, want, res.Body.String())
		}
		return res.Body.String()
	}
	read := func(actor int, want, hidden []string) {
		t.Helper()
		raw := request(actor, "GET", "/api/conversations/group/messages", s.listMessages, groupID, "", 200)
		var messages []message
		if err := json.Unmarshal([]byte(raw), &messages); err != nil {
			t.Fatal(err)
		}
		for _, text := range want {
			if !strings.Contains(raw, text) {
				t.Errorf("viewer %d missing visible %q: %s", actor, text, raw)
			}
		}
		for _, text := range hidden {
			if strings.Contains(raw, text) {
				t.Errorf("viewer %d saw blocked %q: %s", actor, text, raw)
			}
		}
	}
	// A and B start as friends: blocking removes the friendship, but unblock must not restore it.
	if _, err := db.Exec(ctx, `INSERT INTO friend_connections(user_low,user_high,requested_by,status)
		VALUES($1,$2,$3,'accepted')`, min(ids[0], ids[1]), max(ids[0], ids[1]), ids[0]); err != nil {
		t.Fatal(err)
	}
	read(0, []string{"A says hello", "C says hello", "B-secret"}, nil)
	request(0, "POST", "/api/users/id/block", s.blockUser, ids[1], "", 200)
	read(0, []string{"A says hello", "C says hello"}, []string{"B-secret"})
	read(1, []string{"C says hello", "B-secret"}, []string{"A says hello"})
	read(2, []string{"A says hello", "C says hello", "B-secret"}, nil)

	shared := request(0, "GET", "/api/conversations/group/shared?kind=links", s.listSharedContent, groupID, "", 200)
	if strings.Contains(shared, "B-secret") {
		t.Fatalf("blocked shared link exposed: %s", shared)
	}
	shared = request(2, "GET", "/api/conversations/group/shared?kind=links", s.listSharedContent, groupID, "", 200)
	if !strings.Contains(shared, "B-secret") {
		t.Fatalf("third party lost shared link: %s", shared)
	}

	for _, actor := range []int{0, 1, 2} {
		raw := request(actor, "GET", "/api/conversations", s.listConversations, 0, "", 200)
		var rooms []conversation
		if err := json.Unmarshal([]byte(raw), &rooms); err != nil {
			t.Fatal(err)
		}
		if len(rooms) != 1 || rooms[0].ID != groupID {
			t.Fatalf("group hidden from %d: %s", actor, raw)
		}
		if actor == 0 && (strings.Contains(rooms[0].LastMessage, "B-secret") || rooms[0].UnreadCount != 1) {
			t.Fatalf("group preview/unread leaked to A: %+v", rooms[0])
		}
		if actor == 2 && !strings.Contains(rooms[0].LastMessage, "B-secret") {
			t.Fatalf("third party preview lost: %+v", rooms[0])
		}
	}

	// Marking read must never acknowledge B's hidden (newer) message for A.
	readState := request(0, "POST", "/api/conversations/group/read", s.markRead, groupID, "", 200)
	var state struct {
		LastReadMessageID int64 `json:"lastReadMessageId"`
	}
	if err := json.Unmarshal([]byte(readState), &state); err != nil || state.LastReadMessageID != messageIDs[1] {
		t.Fatalf("read state acknowledged invisible B message: %s, %v", readState, err)
	}

	allowed, err := s.visibleRecipients(ctx, ids[1], []int64{ids[0], ids[1], ids[2]})
	if err != nil || len(allowed) != 2 || allowed[0] != ids[1] || allowed[1] != ids[2] {
		t.Fatalf("incorrect realtime/push recipients: %v, %v", allowed, err)
	}
	request(0, "DELETE", "/api/users/id/block", s.unblockUser, ids[1], "", 200)
	read(0, []string{"A says hello", "C says hello", "B-secret"}, nil)
	var stillFriends bool
	if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM friend_connections
		WHERE user_low=$1 AND user_high=$2)`, min(ids[0], ids[1]), max(ids[0], ids[1])).Scan(&stillFriends); err != nil || stillFriends {
		t.Fatalf("unblock must not restore friendship: %v, %v", stillFriends, err)
	}
	// B can now block A without sending or accepting a new friend request.
	request(1, "POST", "/api/users/id/block", s.blockUser, ids[0], "", 200)
	read(0, []string{"A says hello", "C says hello"}, []string{"B-secret"})
	read(1, []string{"C says hello", "B-secret"}, []string{"A says hello"})
	read(2, []string{"A says hello", "C says hello", "B-secret"}, nil)
	request(1, "DELETE", "/api/users/id/block", s.unblockUser, ids[0], "", 200)
	read(0, []string{"A says hello", "C says hello", "B-secret"}, nil)
}
