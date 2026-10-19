package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"chatnet/internal/mediax"
	"chatnet/internal/onesignalx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func TestSameMessageRequest(t *testing.T) {
	reply := int64(7)
	base := message{ConversationID: 3, Text: "hello", ReplyToMessageID: &reply,
		Attachments: []mediax.Attachment{{StorageRef: "object/a"}, {StorageRef: "object/b"}}}
	inputs := []mediax.AttachmentInput{{StorageRef: "object/a"}, {StorageRef: "object/b"}}
	if !sameMessageRequest(base, 3, "hello", &reply, inputs) {
		t.Fatal("same request must be accepted")
	}
	for _, tc := range []struct {
		name           string
		conversationID int64
		text           string
		reply          *int64
		attachments    []mediax.AttachmentInput
	}{
		{"different conversation", 4, "hello", &reply, inputs},
		{"different body", 3, "another", &reply, inputs},
		{"missing reply", 3, "hello", nil, inputs},
		{"missing attachment", 3, "hello", &reply, inputs[:1]},
		{"reordered attachments", 3, "hello", &reply, []mediax.AttachmentInput{inputs[1], inputs[0]}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if sameMessageRequest(base, tc.conversationID, tc.text, tc.reply, tc.attachments) {
				t.Fatal("reused client ID with different payload must be rejected")
			}
		})
	}
}

func TestMessageIdempotencyIntegration(t *testing.T) {
	dbURL, redisAddr := os.Getenv("CHATNET_TEST_DATABASE_URL"), os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if dbURL == "" || redisAddr == "" {
		t.Skip("requires isolated PostgreSQL and Redis via CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR")
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
	s := &server{db: db, redis: rdb, push: onesignalx.New("", "")}

	var users [3]int64
	for i := range users {
		username := fmt.Sprintf("msgretry_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, username+"@example.com", username).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", users[i])
	}
	var conversationID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,direct_key,created_by)
		VALUES('direct',$1,$2) RETURNING id`, directKey(users[0], users[1]), users[0]).Scan(&conversationID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "DELETE FROM conversations WHERE id=$1", conversationID)
	for _, userID := range users[:2] {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id)
			VALUES($1,$2)`, conversationID, userID); err != nil {
			t.Fatal(err)
		}
	}

	token, err := authx.Sign("test", users[0], "sender", "Sender")
	if err != nil {
		t.Fatal(err)
	}
	handler := authx.Middleware("test", http.HandlerFunc(s.createMessage))
	send := func(clientID, body string) (int, message) {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/conversations/%d/messages", conversationID),
			strings.NewReader(fmt.Sprintf(`{"clientId":%q,"text":%q}`, clientID, body)))
		r.SetPathValue("id", fmt.Sprint(conversationID))
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		var m message
		_ = json.Unmarshal(w.Body.Bytes(), &m)
		return w.Code, m
	}

	// Subscribe as user B before user A sends: this verifies the real Redis fanout.
	pubsub := rdb.Subscribe(ctx, userChannel(users[1]))
	defer pubsub.Close()
	subscribeCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if _, err := pubsub.Receive(subscribeCtx); err != nil {
		t.Fatal(err)
	}
	events := pubsub.Channel()

	clientID := fmt.Sprintf("retry-%d", time.Now().UnixNano())
	status, original := send(clientID, "hello")
	if status != http.StatusCreated || original.ID <= 0 || original.ClientID != clientID {
		t.Fatalf("first send: status=%d message=%+v", status, original)
	}
	select {
	case event := <-events:
		var update realtimeEvent
		if err := json.Unmarshal([]byte(event.Payload), &update); err != nil || update.Type != "message" || update.Message == nil || update.Message.ID != original.ID {
			t.Fatalf("user B received wrong realtime event: %+v %v", update, err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("user B did not receive the realtime message")
	}
	// User C was never added to the conversation and cannot fetch its history.
	outsiderToken, err := authx.Sign("test", users[2], "outsider", "Outsider")
	if err != nil {
		t.Fatal(err)
	}
	listRequest := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/conversations/%d/messages", conversationID), nil)
	listRequest.SetPathValue("id", fmt.Sprint(conversationID))
	listRequest.Header.Set("Authorization", "Bearer "+outsiderToken)
	listResult := httptest.NewRecorder()
	authx.Middleware("test", http.HandlerFunc(s.listMessages)).ServeHTTP(listResult, listRequest)
	if listResult.Code != http.StatusForbidden {
		t.Fatalf("user C accessed private conversation: HTTP %d", listResult.Code)
	}
	if status, replay := send(clientID, "hello"); status != http.StatusOK || replay.ID != original.ID {
		t.Fatalf("lost ACK replay: status=%d message=%+v", status, replay)
	}
	if status, _ := send(clientID, "different text"); status != http.StatusConflict {
		t.Fatalf("client ID collision should be 409, got %d", status)
	}

	var wg sync.WaitGroup
	const parallel = 5
	codes := make(chan int, parallel)
	ids := make(chan int64, parallel)
	for i := 0; i < parallel; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			status, m := send("parallel-"+clientID, "race")
			codes <- status
			ids <- m.ID
		}()
	}
	wg.Wait()
	close(codes)
	close(ids)
	var raceID int64
	for code := range codes {
		if code != http.StatusCreated && code != http.StatusOK {
			t.Fatalf("concurrent retry status=%d", code)
		}
	}
	for id := range ids {
		if id <= 0 || (raceID != 0 && id != raceID) {
			t.Fatalf("multiple IDs for same client ID: %d and %d", raceID, id)
		}
		raceID = id
	}
	var count int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM messages WHERE user_id=$1 AND client_id=$2`,
		users[0], "parallel-"+clientID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("expected exactly one durable message, count=%d err=%v", count, err)
	}
}
