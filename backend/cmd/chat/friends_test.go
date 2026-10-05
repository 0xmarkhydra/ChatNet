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

func TestFriendRequestsIntegration(t *testing.T) {
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
	tokens := make([]string, 2)
	for i := range ids {
		name := fmt.Sprintf("friend_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.com", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	subs := []*redis.PubSub{rdb.Subscribe(ctx, userChannel(ids[0])), rdb.Subscribe(ctx, userChannel(ids[1]))}
	for _, sub := range subs {
		defer sub.Close()
		if _, err := sub.Receive(ctx); err != nil {
			t.Fatal(err)
		}
	}
	eventBoth := func() {
		t.Helper()
		for _, sub := range subs {
			waitCtx, cancel := context.WithTimeout(ctx, time.Second)
			msg, err := sub.ReceiveMessage(waitCtx)
			cancel()
			if err != nil {
				t.Fatal(err)
			}
			var event realtimeEvent
			if json.Unmarshal([]byte(msg.Payload), &event) != nil || event.Type != "friend.updated" {
				t.Fatalf("wrong event: %s", msg.Payload)
			}
		}
	}
	request := func(actor int, endpoint http.HandlerFunc, method, query string, want int) friendConnection {
		t.Helper()
		r := httptest.NewRequest(method, "/api/friends/test"+query, nil)
		r.SetPathValue("id", fmt.Sprint(ids[1-actor]))
		r.Header.Set("Authorization", "Bearer "+tokens[actor])
		w := httptest.NewRecorder()
		authx.Middleware("test", endpoint).ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s %s: got %d %s, want %d", method, query, w.Code, w.Body.String(), want)
		}
		var item friendConnection
		_ = json.Unmarshal(w.Body.Bytes(), &item)
		return item
	}
	request(0, s.removeFriendConnection, "DELETE", "?direction=bad", 400)
	if item := request(0, s.sendFriendRequest, "POST", "", 200); item.Direction != "outgoing" {
		t.Fatalf("sender direction: %+v", item)
	}
	eventBoth()
	request(0, s.sendFriendRequest, "POST", "", 200)
	if item := request(1, s.sendFriendRequest, "POST", "", 200); item.Direction != "incoming" {
		t.Fatalf("crossed request lost direction: %+v", item)
	}
	request(0, s.acceptFriendRequest, "POST", "", 404)
	request(0, s.removeFriendConnection, "DELETE", "?direction=incoming", 409)
	if item := request(1, s.acceptFriendRequest, "POST", "", 200); item.Status != "accepted" {
		t.Fatalf("accept: %+v", item)
	}
	eventBoth()
	request(0, s.removeFriendConnection, "DELETE", "?direction=outgoing", 409)
	if item := request(0, s.sendFriendRequest, "POST", "", 200); item.Status != "accepted" {
		t.Fatal("stale cancellation removed friendship")
	}
	request(0, s.removeFriendConnection, "DELETE", "", 200)
	eventBoth()
	request(1, s.sendFriendRequest, "POST", "", 200)
	eventBoth()
	request(0, s.removeFriendConnection, "DELETE", "?direction=incoming", 200)
	eventBoth()
	request(0, s.sendFriendRequest, "POST", "", 200)
	eventBoth()
	request(0, s.removeFriendConnection, "DELETE", "?direction=outgoing", 200)
	eventBoth()
	if _, err := s.friendConnectionFor(ctx, ids[0], ids[1]); err == nil {
		t.Fatal("cancel retained request")
	}
}
