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
)

func TestClearConversationHistoryIntegration(t *testing.T) {
	uri := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("CHATNET_TEST_DATABASE_URL must point to a disposable test database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	userIDs := make([]int64, 3)
	tokens := make([]string, 3)
	prefix := fmt.Sprintf("clear_test_%d", time.Now().UnixNano())
	for i := range userIDs {
		username := fmt.Sprintf("%s_%d", prefix, i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!', $2) RETURNING id`, username+"@example.invalid", username).Scan(&userIDs[i]); err != nil {
			t.Fatal(err)
		}
		id := userIDs[i]
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
		tokens[i], err = authx.Sign("test", id, username, username)
		if err != nil {
			t.Fatal(err)
		}
	}
	var conversationID int64
	if err := db.QueryRow(ctx, "INSERT INTO conversations(type,name,created_by) VALUES('group','History test',$1) RETURNING id", userIDs[0]).Scan(&conversationID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", conversationID)
	for _, id := range userIDs[:2] {
		if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", conversationID, id); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range userIDs[:2] {
		if _, err := db.Exec(ctx, "INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,$3)", conversationID, id, "Private old text https://example.invalid/"+prefix); err != nil {
			t.Fatal(err)
		}
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	mux.Handle("DELETE /api/conversations/{id}/history", authx.Middleware("test", http.HandlerFunc(s.clearConversationHistory)))
	mux.Handle("GET /api/conversations/{id}/messages", authx.Middleware("test", http.HandlerFunc(s.listMessages)))
	mux.Handle("GET /api/conversations/{id}/shared", authx.Middleware("test", http.HandlerFunc(s.listSharedContent)))
	request := func(user int, method, suffix string, want int) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, fmt.Sprintf("/api/conversations/%d/%s", conversationID, suffix), nil)
		req.Header.Set("Authorization", "Bearer "+tokens[user])
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		if w.Code != want {
			t.Fatalf("%s %s: got %d want %d: %s", method, suffix, w.Code, want, w.Body.String())
		}
		return w
	}
	readCount := func(user, want int) {
		t.Helper()
		var messages []message
		if err := json.Unmarshal(request(user, "GET", "messages", 200).Body.Bytes(), &messages); err != nil {
			t.Fatal(err)
		}
		if len(messages) != want {
			t.Fatalf("user %d saw %d messages, want %d", user, len(messages), want)
		}
	}
	readCount(0, 2)
	readCount(1, 2)
	request(2, "DELETE", "history", 403)
	request(0, "DELETE", "history", 200)
	readCount(0, 0)
	readCount(1, 2)
	var shared sharedContentPage
	if err := json.Unmarshal(request(0, "GET", "shared?kind=links", 200).Body.Bytes(), &shared); err != nil {
		t.Fatal(err)
	}
	if len(shared.Items) != 0 {
		t.Fatal("cleared shared content still visible")
	}
	if _, err := db.Exec(ctx, "INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,'new text')", conversationID, userIDs[1]); err != nil {
		t.Fatal(err)
	}
	readCount(0, 1)
	readCount(1, 3)
	request(0, "DELETE", "history", 200)
	readCount(0, 0)
}
