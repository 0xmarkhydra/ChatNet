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

func TestDisplayNamesChatIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	ids := make([]int64, 2)
	names := []string{fmt.Sprintf("label_%d_a", time.Now().UnixNano()), fmt.Sprintf("label_%d_b", time.Now().UnixNano())}
	tokens := make([]string, 2)
	for i := range ids {
		if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!','Tên trong token cũ') RETURNING id", names[i]+"@example.invalid", names[i]).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], names[i], "Tên trong token cũ")
		if err != nil {
			t.Fatal(err)
		}
		// Matching labels must not merge identities; old JWT labels must not override DB.
		if _, err := db.Exec(ctx, "UPDATE users SET display_name='Nguyễn An' WHERE id=$1", ids[i]); err != nil {
			t.Fatal(err)
		}
	}
	var cid int64
	if err := db.QueryRow(ctx, "INSERT INTO conversations(type,name,created_by) VALUES('group','Names',$1) RETURNING id", ids[0]).Scan(&cid); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", cid)
	for _, id := range ids {
		if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", cid, id); err != nil {
			t.Fatal(err)
		}
	}
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:6379", DialTimeout: 10 * time.Millisecond, ReadTimeout: 10 * time.Millisecond, WriteTimeout: 10 * time.Millisecond, MaxRetries: -1})
	defer rdb.Close()
	s := &server{db: db, redis: rdb, push: onesignalx.New("", "")}
	mux := http.NewServeMux()
	mux.Handle("GET /api/conversations", authx.Middleware("test", http.HandlerFunc(s.listConversations)))
	mux.Handle("GET /api/conversations/{id}/messages", authx.Middleware("test", http.HandlerFunc(s.listMessages)))
	mux.Handle("PATCH /api/messages/{id}", authx.Middleware("test", http.HandlerFunc(s.editMessage)))
	mux.Handle("POST /api/conversations/{id}/messages", authx.Middleware("test", http.HandlerFunc(s.createMessage)))
	send := func(i int, body string) message {
		t.Helper()
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/conversations/%d/messages", cid), strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tokens[i])
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != 201 {
			t.Fatalf("send: %d %s", rec.Code, rec.Body.String())
		}
		var m message
		if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
			t.Fatal(err)
		}
		if m.Sender != names[i] || m.SenderID != ids[i] || m.SenderDisplayName != "Nguyễn An" {
			t.Fatalf("identity/label mismatch: %+v", m)
		}
		return m
	}
	first := send(0, `{"text":"Xin chào"}`)
	second := send(1, fmt.Sprintf(`{"text":"Trả lời","replyToMessageId":%d}`, first.ID))
	if second.ReplyToSender != names[0] || second.ReplyToDisplayName != "Nguyễn An" {
		t.Fatalf("reply label: %+v", second)
	}
	if _, err := db.Exec(ctx, "UPDATE users SET display_name='Tên mới có dấu' WHERE id=$1", ids[0]); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("GET", fmt.Sprintf("/api/conversations/%d/messages", cid), nil)
	req.Header.Set("Authorization", "Bearer "+tokens[1])
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("list messages: %d %s", rec.Code, rec.Body.String())
	}
	var messages []message
	if err := json.Unmarshal(rec.Body.Bytes(), &messages); err != nil {
		t.Fatal(err)
	}
	if len(messages) != 2 || messages[0].Sender != names[0] || messages[0].SenderDisplayName != "Tên mới có dấu" {
		t.Fatalf("message list labels: %+v", messages)
	}
	req = httptest.NewRequest("PATCH", fmt.Sprintf("/api/messages/%d", first.ID), strings.NewReader(`{"text":"stolen"}`))
	req.Header.Set("Authorization", "Bearer "+tokens[1])
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != 404 {
		t.Fatalf("duplicate label granted edit ownership: %d %s", rec.Code, rec.Body.String())
	}
	var directID int64
	if err := db.QueryRow(ctx, "INSERT INTO conversations(type,direct_key,created_by) VALUES('direct',$1,$2) RETURNING id", fmt.Sprintf("%d:%d", ids[0], ids[1]), ids[0]).Scan(&directID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", directID)
	for _, id := range ids {
		if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", directID, id); err != nil {
			t.Fatal(err)
		}
	}
	req = httptest.NewRequest("GET", "/api/conversations", nil)
	req.Header.Set("Authorization", "Bearer "+tokens[1])
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var conversations []conversation
	if rec.Code != 200 {
		t.Fatalf("list conversations: %d %s", rec.Code, rec.Body.String())
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &conversations); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range conversations {
		if c.ID == directID {
			found = true
			if c.Name != "Tên mới có dấu" || c.OtherUsername != names[0] || c.OtherUserID == nil || *c.OtherUserID != ids[0] {
				t.Fatalf("direct peer identity: %+v", c)
			}
		}
	}
	if !found {
		t.Fatal("missing direct conversation")
	}
	loaded, err := s.loadMessage(ctx, second.ID, ids[1])
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ReplyToSender != names[0] || loaded.ReplyToDisplayName != "Tên mới có dấu" || loaded.SenderDisplayName != "Nguyễn An" {
		t.Fatalf("loaded labels: %+v", loaded)
	}
}
