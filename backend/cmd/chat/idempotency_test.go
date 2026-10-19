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

func TestMessageRequestFingerprint(t *testing.T) {
	reply := int64(17)
	refs := []mediax.AttachmentInput{
		{StorageRef: "s3://bucket/ref-1"},
		{StorageRef: "s3://bucket/ref-2"},
	}
	baseline := messageRequestFingerprint(3, "hello", &reply, refs)
	if baseline != messageRequestFingerprint(3, "hello", &reply, refs) || len(baseline) != 64 {
		t.Fatal("fingerprint must be deterministic and SHA-256 hex")
	}
	for _, tc := range []struct {
		name         string
		conversation int64
		text         string
		reply        *int64
		attachments  []mediax.AttachmentInput
	}{
		{"conversation change", 4, "hello", &reply, refs},
		{"content change", 3, "edited", &reply, refs},
		{"removed reply", 3, "hello", nil, refs},
		{"removed media", 3, "hello", &reply, refs[:1]},
		{"reordered media", 3, "hello", &reply, []mediax.AttachmentInput{refs[1], refs[0]}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := messageRequestFingerprint(tc.conversation, tc.text, tc.reply, tc.attachments); got == baseline {
				t.Fatal("different message request must change immutable fingerprint")
			}
		})
	}
	if baseline != messageRequestFingerprint(3, "hello", &reply,
		[]mediax.AttachmentInput{{StorageRef: " s3://bucket/ref-1 "}, {StorageRef: "s3://bucket/ref-2"}}) {
		t.Fatal("whitespace around storage ref must be normalized")
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

	// Lost HTTP ACK can arrive after the original has been edited/recalled.
	// The immutable request fingerprint must still identify the original POST.
	editReq := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/messages/%d", original.ID), strings.NewReader(`{"text":"updated on another device"}`))
	editReq.SetPathValue("id", fmt.Sprint(original.ID))
	editReq.Header.Set("Authorization", "Bearer "+token)
	editResponse := httptest.NewRecorder()
	authx.Middleware("test", http.HandlerFunc(s.editMessage)).ServeHTTP(editResponse, editReq)
	if editResponse.Code != http.StatusOK {
		t.Fatalf("could not edit original: %s", editResponse.Body.String())
	}
	if status, replay := send(clientID, "hello"); status != http.StatusOK || replay.ID != original.ID || replay.Text != "updated on another device" {
		t.Fatalf("retry after edit must reuse original ID: status=%d msg=%+v", status, replay)
	}
	if status, _ := send(clientID, "updated on another device"); status != http.StatusConflict {
		t.Fatalf("mutated text must not become accepted as original fingerprint, got %d", status)
	}

	revokeReq := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/messages/%d", original.ID), nil)
	revokeReq.SetPathValue("id", fmt.Sprint(original.ID))
	revokeReq.Header.Set("Authorization", "Bearer "+token)
	revokeResponse := httptest.NewRecorder()
	authx.Middleware("test", http.HandlerFunc(s.deleteMessage)).ServeHTTP(revokeResponse, revokeReq)
	if revokeResponse.Code != http.StatusOK {
		t.Fatalf("could not recall original: %s", revokeResponse.Body.String())
	}
	if status, replay := send(clientID, "hello"); status != http.StatusOK || replay.ID != original.ID || !replay.Deleted {
		t.Fatalf("retry after recall must reuse recalled message ID: status=%d msg=%+v", status, replay)
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

	t.Run("kicked member loses write and history privileges", func(t *testing.T) {
		var groupID int64
		if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by)
			VALUES('group','ACL integration', $1) RETURNING id`, users[0]).Scan(&groupID); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM conversations WHERE id=$1", groupID)
		for i, userID := range users[:2] {
			role := "member"
			if i == 0 {
				role = "owner"
			}
			if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role)
				VALUES($1,$2,$3)`, groupID, userID, role); err != nil {
				t.Fatal(err)
			}
		}
		memberToken, err := authx.Sign("test", users[1], "member", "Member")
		if err != nil {
			t.Fatal(err)
		}
		sendGroup := func() (int, message) {
			req := httptest.NewRequest(http.MethodPost,
				fmt.Sprintf("/api/conversations/%d/messages", groupID),
				strings.NewReader(`{"text":"before kick","clientId":"group-pre-kick"}`))
			req.SetPathValue("id", fmt.Sprint(groupID))
			req.Header.Set("Authorization", "Bearer "+memberToken)
			result := httptest.NewRecorder()
			authx.Middleware("test", http.HandlerFunc(s.createMessage)).ServeHTTP(result, req)
			var saved message
			_ = json.Unmarshal(result.Body.Bytes(), &saved)
			return result.Code, saved
		}
		status, groupMessage := sendGroup()
		if status != http.StatusCreated || groupMessage.ID <= 0 {
			t.Fatalf("member could not send prior to kick: HTTP %d msg=%+v", status, groupMessage)
		}
		if _, err := db.Exec(ctx,
			"DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",
			groupID, users[1]); err != nil {
			t.Fatal(err)
		}

		if status, _ := sendGroup(); status != http.StatusForbidden {
			t.Fatalf("kicked member sent message: HTTP %d", status)
		}
		call := func(method, endpoint, body, messageID string, handler http.HandlerFunc) int {
			req := httptest.NewRequest(method, endpoint, strings.NewReader(body))
			req.SetPathValue("id", messageID)
			req.Header.Set("Authorization", "Bearer "+memberToken)
			result := httptest.NewRecorder()
			authx.Middleware("test", handler).ServeHTTP(result, req)
			return result.Code
		}
		endpoint := fmt.Sprintf("/api/messages/%d", groupMessage.ID)
		if code := call(http.MethodPatch, endpoint, `{"text":"illegal edit"}`, fmt.Sprint(groupMessage.ID), s.editMessage); code == http.StatusOK {
			t.Fatal("kicked member edited old message")
		}
		if code := call(http.MethodDelete, endpoint, "", fmt.Sprint(groupMessage.ID), s.deleteMessage); code == http.StatusOK {
			t.Fatal("kicked member recalled old message")
		}
		if code := call(http.MethodPost, endpoint+"/reactions", `{"emoji":"👍"}`, fmt.Sprint(groupMessage.ID), s.toggleMessageReaction); code != http.StatusForbidden {
			t.Fatalf("kicked member reaction was not rejected: HTTP %d", code)
		}
		if code := call(http.MethodGet, fmt.Sprintf("/api/conversations/%d/messages", groupID),
			"", fmt.Sprint(groupID), s.listMessages); code != http.StatusForbidden {
			t.Fatalf("kicked member read history: HTTP %d", code)
		}
		if code := call(http.MethodGet, fmt.Sprintf("/api/conversations/%d/shared", groupID),
			"", fmt.Sprint(groupID), s.listSharedContent); code != http.StatusForbidden {
			t.Fatalf("kicked member read shared media: HTTP %d", code)
		}
		var savedText string
		var deleted bool
		if err := db.QueryRow(ctx, "SELECT text,deleted_at IS NOT NULL FROM messages WHERE id=$1",
			groupMessage.ID).Scan(&savedText, &deleted); err != nil || savedText != "before kick" || deleted {
			t.Fatalf("denied writes altered stored message: %q deleted=%v err=%v", savedText, deleted, err)
		}
	})
}
