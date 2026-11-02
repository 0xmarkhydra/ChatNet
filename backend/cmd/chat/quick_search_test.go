package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestQuickChatSearchQueryLimit(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/chat/search?q="+url.QueryEscape(strings.Repeat("ệ", 121)), nil)
	rec := httptest.NewRecorder()
	(&server{}).quickChatSearch(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", rec.Code)
	}
}

func TestQuickChatSearchIntegration(t *testing.T) {
	uri := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("requires disposable CHATNET_TEST_DATABASE_URL schema")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	prefix := fmt.Sprintf("quick_search_%d", time.Now().UnixNano())
	ids := make([]int64, 3)
	for i := range ids {
		if err = db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'test',$3) RETURNING id`,
			fmt.Sprintf("%s_%d@example.invalid", prefix, i), fmt.Sprintf("%s_%d", prefix, i),
			[]string{"Viewer", "Nguyễn Văn", "Blocked Author"}[i]).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		userID := ids[i]
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", userID)
	}
	makeConversation := func(typ, name string, participants ...int64) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by) VALUES($1,$2,$3) RETURNING id`,
			typ, name, ids[0]).Scan(&id); err != nil {
			t.Fatal(err)
		}
		for _, uid := range participants {
			if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)`, id, uid); err != nil {
				t.Fatal(err)
			}
		}
		return id
	}
	direct := makeConversation("direct", "", ids[0], ids[1])
	group := makeConversation("group", "Kế hoạch dự án", ids[0])
	privateGroup := makeConversation("group", "Kế hoạch bí mật", ids[1])
	blockedGroup := makeConversation("group", "Other team", ids[0], ids[2])
	_ = group

	message := func(cid, sender int64, text string) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,$3) RETURNING id`,
			cid, sender, text).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	msgID := message(direct, ids[1], "Tìm kiếm nội dung trước đây")
	message(privateGroup, ids[1], "Tìm kiếm riêng tư")
	message(blockedGroup, ids[2], "Tìm kiếm bị chặn")
	if _, err := db.Exec(ctx, `INSERT INTO message_attachments(message_id,storage_ref,original_name,content_type,size_bytes,kind)
        VALUES($1,'test-private-ref','Báo cáo tài chính.pdf','application/pdf',64,'file')`, msgID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, ids[0], ids[2]); err != nil {
		t.Fatal(err)
	}

	token, err := authx.Sign("test", ids[0], prefix, prefix)
	if err != nil {
		t.Fatal(err)
	}
	search := func(q string) quickResults {
		t.Helper()
		req := httptest.NewRequest("GET", "/api/chat/search?q="+url.QueryEscape(q), nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		authx.Middleware("test", http.HandlerFunc(s.quickChatSearch)).ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("search %q: %d %s", q, rec.Code, rec.Body.String())
		}
		var got quickResults
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		return got
	}
	if got := search("nguyen van"); len(got.Contacts) != 1 || got.Contacts[0].ID != ids[1] {
		t.Fatalf("contact accent match: %+v", got.Contacts)
	}
	if got := search("ke hoach du an"); len(got.Contacts) != 1 || got.Contacts[0].Conversation == nil || got.Contacts[0].Conversation.ID != group {
		t.Fatalf("group match/membership: %+v", got.Contacts)
	}
	if got := search("tim kiem"); len(got.Messages) != 1 || got.Messages[0].ID != msgID || got.Messages[0].Conversation.ID != direct {
		t.Fatalf("message visibility or accent match: %+v", got.Messages)
	}
	files := search("bao cao")
	if len(files.Files) != 1 || files.Files[0].FileName != "Báo cáo tài chính.pdf" || files.Files[0].ID != msgID {
		t.Fatalf("file name accent match: %+v", files.Files)
	}
	encoded, _ := json.Marshal(files)
	if strings.Contains(string(encoded), "test-private-ref") {
		t.Fatal("file storage reference leaked")
	}
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	if got := search("tim kiem"); len(got.Messages) != 0 {
		t.Fatalf("blocked direct leaked: %+v", got.Messages)
	}
	if got := search("bao cao"); len(got.Files) != 0 {
		t.Fatalf("blocked file leaked: %+v", got.Files)
	}
}
