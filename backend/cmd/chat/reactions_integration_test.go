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

// Opt-in, local-only E2E. Does not modify existing QA users or conversations.
func TestMessageReactionsLocalIntegration(t *testing.T) {
	if os.Getenv("CHATNET_REACTIONS_LOCAL_TEST") != "1" {
		t.Skip("set CHATNET_REACTIONS_LOCAL_TEST=1 for local PostgreSQL+Valkey integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()
	const dsn = "postgres://chatnet:chatnet@127.0.0.1:5432/chatnet?sslmode=disable"
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:6379"})
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db, redis: rdb, jwtSecret: "test-reactions-secret"}

	ids := make([]int64, 3)
	tokens := make([]string, 3)
	for i := range ids {
		name := fmt.Sprintf("reaction_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
      VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		tokens[i], err = authx.Sign(s.jwtSecret, ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	var conversationID, messageID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by) VALUES('group','reaction tests',$1) RETURNING id`, ids[0]).Scan(&conversationID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if _, err := db.Exec(cleanup, `DELETE FROM conversations WHERE id=$1`, conversationID); err != nil {
			t.Errorf("cleanup conversation: %v", err)
		}
		for _, id := range ids {
			if _, err := db.Exec(cleanup, `DELETE FROM users WHERE id=$1`, id); err != nil {
				t.Errorf("cleanup user: %v", err)
			}
		}
	})
	for _, id := range ids[:2] {
		if _, err = db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,'member')`, conversationID, id); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,'reactions test') RETURNING id`, conversationID, ids[0]).Scan(&messageID); err != nil {
		t.Fatal(err)
	}

	call := func(actor int, emoji string, want int) message {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%d/reactions", messageID), strings.NewReader(fmt.Sprintf(`{"emoji":%q}`, emoji)))
		req.SetPathValue("id", fmt.Sprint(messageID))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		result := httptest.NewRecorder()
		authx.Middleware(s.jwtSecret, http.HandlerFunc(s.toggleMessageReaction)).ServeHTTP(result, req)
		if result.Code != want {
			t.Fatalf("actor %d emoji %s: HTTP %d, expected %d, body=%s", actor, emoji, result.Code, want, result.Body.String())
		}
		var m message
		if want == http.StatusOK {
			if err := json.Unmarshal(result.Body.Bytes(), &m); err != nil {
				t.Fatal(err)
			}
		}
		return m
	}
	assert := func(actor int, emoji string, count int, mine bool) {
		t.Helper()
		var rows []struct {
			emoji string
			count int
			mine  bool
		}
		m, err := s.loadMessage(ctx, messageID, ids[actor])
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range m.Reactions {
			rows = append(rows, struct {
				emoji string
				count int
				mine  bool
			}{r.Emoji, r.Count, r.Mine})
		}
		matched := false
		for _, reaction := range rows {
			if reaction.emoji == emoji && reaction.count == count && reaction.mine == mine {
				matched = true
			}
		}
		if !matched {
			t.Fatalf("viewer %d: %+v want %s x%d mine=%v", actor, rows, emoji, count, mine)
		}
	}

	call(0, "👍", 200)
	assert(0, "👍", 1, true)
	assert(1, "👍", 1, false)
	call(1, "👍", 200)
	assert(0, "👍", 2, true)
	call(0, "❤️", 200)
	assert(0, "❤️", 1, true)
	m, err := s.loadMessage(ctx, messageID, ids[1])
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Reactions) != 2 {
		t.Fatalf("switch must preserve peer like, got %+v", m.Reactions)
	}
	call(0, "❤️", 200) // same reaction removes it
	assert(1, "👍", 1, true)
	call(0, "😂", 200)
	call(0, "😮", 200)
	call(0, "😢", 200)
	call(0, "😡", 200)
	assert(0, "😡", 1, true)
	call(0, "🦄", 400)
	call(2, "👍", 403)

	// Realtime updates must carry recipient-specific 'mine', not actor's flag.
	peerEvents := rdb.Subscribe(ctx, authx.UserChannel(ids[1]))
	defer peerEvents.Close()
	if _, err := peerEvents.Receive(ctx); err != nil {
		t.Fatal(err)
	}
	call(0, "😢", 200)
	receivedCtx, stop := context.WithTimeout(ctx, 3*time.Second)
	defer stop()
	event, err := peerEvents.ReceiveMessage(receivedCtx)
	if err != nil {
		t.Fatal(err)
	}
	var payload realtimeEvent
	if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Type != "message.updated" || payload.Message == nil {
		t.Fatalf("unexpected event: %+v", payload)
	}
	for _, reaction := range payload.Message.Reactions {
		if reaction.Emoji == "👍" && !reaction.Mine {
			t.Fatalf("recipient lost own reaction state: %+v", payload.Message.Reactions)
		}
		if reaction.Emoji == "😢" && reaction.Mine {
			t.Fatalf("recipient inherited sender reaction state: %+v", payload.Message.Reactions)
		}
	}

	if _, err := db.Exec(ctx, `DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2`, conversationID, ids[1]); err != nil {
		t.Fatal(err)
	}
	call(1, "😡", 403)
}
