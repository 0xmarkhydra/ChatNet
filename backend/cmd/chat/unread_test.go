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
	"github.com/redis/go-redis/v9"
)

func TestUnreadRequiresAuthentication(t *testing.T) {
	res := httptest.NewRecorder()
	(&server{}).unreadSummary(res, httptest.NewRequest("GET", "/api/conversations/unread", nil))
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", res.Code)
	}
}

func TestExactConversationRejectsInvalidIDs(t *testing.T) {
	for _, id := range []string{"-1", "0", "abc", "1.5", "9223372036854775808"} {
		res := httptest.NewRecorder()
		(&server{}).listConversations(res, httptest.NewRequest("GET", "/api/conversations?id="+id, nil))
		if res.Code != http.StatusBadRequest {
			t.Fatalf("id %q: %d", id, res.Code)
		}
	}
}

func TestUnreadAndExactLookupVisibilityIntegration(t *testing.T) {
	if os.Getenv("CHATNET_TEST_DATABASE_URL") == "" || os.Getenv("CHATNET_TEST_REDIS_ADDR") == "" {
		t.Skip("isolated PostgreSQL and Redis test services required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
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
	var users [3]int64
	var tokens [3]string
	for i := range users {
		name := fmt.Sprintf("unread_%d_%d", time.Now().UnixNano(), i)
		if err = db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!',$2) RETURNING id", name+"@example.invalid", name).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", users[i])
		tokens[i], err = authx.Sign("test", users[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	var group, direct int64
	for _, item := range []struct {
		kind   string
		target *int64
	}{{"group", &group}, {"direct", &direct}} {
		if err = db.QueryRow(ctx, "INSERT INTO conversations(type,name,created_by) VALUES($1,'badge QA',$2) RETURNING id", item.kind, users[0]).Scan(item.target); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", *item.target)
		for i, user := range users {
			if item.kind == "direct" && i == 2 {
				continue
			}
			if _, err = db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", *item.target, user); err != nil {
				t.Fatal(err)
			}
		}
	}
	for _, item := range []struct{ room, sender int64 }{{group, users[0]}, {group, users[1]}, {group, users[2]}, {direct, users[1]}} {
		if _, err = db.Exec(ctx, "INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,'badge test')", item.room, item.sender); err != nil {
			t.Fatal(err)
		}
	}
	request := func(actor int, handler http.HandlerFunc, path string) string {
		t.Helper()
		req := httptest.NewRequest("GET", path, nil)
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		res := httptest.NewRecorder()
		authx.Middleware("test", handler).ServeHTTP(res, req)
		if res.Code != 200 {
			t.Fatalf("%s: %d %s", path, res.Code, res.Body.String())
		}
		return res.Body.String()
	}
	count := func(actor int, want int64) {
		t.Helper()
		var value struct {
			UnreadCount int64 `json:"unreadCount"`
		}
		if err := json.Unmarshal([]byte(request(actor, s.unreadSummary, "/api/conversations/unread?userId=999999")), &value); err != nil {
			t.Fatal(err)
		}
		if value.UnreadCount != want {
			t.Fatalf("actor %d: count %d want %d", actor, value.UnreadCount, want)
		}
	}
	lookup := func(actor int, id int64, want int) {
		t.Helper()
		var values []conversation
		if err := json.Unmarshal([]byte(request(actor, s.listConversations, fmt.Sprintf("/api/conversations?limit=1&id=%d", id))), &values); err != nil {
			t.Fatal(err)
		}
		if len(values) != want || (want == 1 && values[0].ID != id) {
			t.Fatalf("wrong exact lookup: %+v", values)
		}
	}
	count(0, 3)
	count(2, 2)
	lookup(0, group, 1)
	lookup(2, direct, 0)
	if _, err = db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", users[1], users[0]); err != nil {
		t.Fatal(err)
	}
	count(0, 1)
	count(2, 2)
	lookup(0, direct, 0)
	lookup(0, group, 1)
	if _, err = db.Exec(ctx, "UPDATE conversation_members SET last_read_message_id=(SELECT MAX(id) FROM messages WHERE conversation_id=$1) WHERE conversation_id=$1 AND user_id=$2", group, users[0]); err != nil {
		t.Fatal(err)
	}
	count(0, 0)
	if _, err = db.Exec(ctx, "DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2", group, users[2]); err != nil {
		t.Fatal(err)
	}
	count(2, 0)
	lookup(2, group, 0)
}
