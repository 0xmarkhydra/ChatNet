package main

import (
	"bytes"
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

func TestChannelReadRequiresAuthentication(t *testing.T) {
	res := httptest.NewRecorder()
	(&server{}).markGroupChannelRead(res, httptest.NewRequest(http.MethodPost,
		"/api/conversations/1/channel-read", bytes.NewBufferString(`{"channelId":0}`)))
	if res.Code != http.StatusBadRequest && res.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous channel read must be rejected; got %d", res.Code)
	}
}

// When isolated PostgreSQL/Redis are provided, prove that reading one channel
// never clears unread counts of the other channels or the group-wide badge.
func TestChannelUnreadIsolationIntegration(t *testing.T) {
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
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	redisClient := redis.NewClient(&redis.Options{Addr: os.Getenv("CHATNET_TEST_REDIS_ADDR")})
	defer redisClient.Close()
	s := &server{db: db, redis: redisClient}

	var ids [3]int64
	var tokens [3]string
	for i := range ids {
		name := fmt.Sprintf("channel_unread_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!',$2) RETURNING id",
			name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign("test", ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	var conversationID int64
	if err := db.QueryRow(ctx, "INSERT INTO conversations(type,name,created_by) VALUES('group','channel badge test',$1) RETURNING id", ids[0]).Scan(&conversationID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", conversationID)
	for i := 0; i < 2; i++ {
		role := "member"
		if i == 0 {
			role = "owner"
		}
		if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,$3)", conversationID, ids[i], role); err != nil {
			t.Fatal(err)
		}
	}
	var channelA, channelB int64
	for _, channel := range []struct {
		name string
		id   *int64
	}{{"Kênh A", &channelA}, {"Kênh B", &channelB}} {
		if err := db.QueryRow(ctx, "INSERT INTO group_channels(conversation_id,name,created_by) VALUES($1,$2,$3) RETURNING id",
			conversationID, channel.name, ids[0]).Scan(channel.id); err != nil {
			t.Fatal(err)
		}
	}
	for _, ch := range []int64{0, channelA, channelB} {
		var channelID any = ch
		if ch == 0 {
			channelID = nil
		}
		if _, err := db.Exec(ctx, "INSERT INTO messages(conversation_id,channel_id,user_id,text) VALUES($1,$2,$3,$4)",
			conversationID, channelID, ids[0], fmt.Sprintf("Message in channel %d", ch)); err != nil {
			t.Fatal(err)
		}
	}

	do := func(actor int, method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.SetPathValue("id", fmt.Sprintf("%d", conversationID))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		recorder := httptest.NewRecorder()
		var handler http.HandlerFunc
		switch {
		case path == "/api/conversations/unread":
			handler = s.unreadSummary
		case method == http.MethodPost:
			handler = s.markGroupChannelRead
		default:
			handler = s.listGroupChannels
		}
		authx.Middleware("test", handler).ServeHTTP(recorder, req)
		return recorder
	}
	load := func() map[int64]int64 {
		t.Helper()
		res := do(1, http.MethodGet, "/api/conversations/test/channels", "")
		if res.Code != http.StatusOK {
			t.Fatalf("list channels: %d %s", res.Code, res.Body.String())
		}
		var channels []groupChannel
		if err := json.Unmarshal(res.Body.Bytes(), &channels); err != nil {
			t.Fatal(err)
		}
		result := make(map[int64]int64)
		for _, ch := range channels {
			result[ch.ID] = ch.UnreadCount
		}
		return result
	}
	// The group badge returned to the conversation list must equal the sum
	// of channel badges, including the default general discussion channel.
	checkGroupBadge := func(channelCounts map[int64]int64) {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet,
			fmt.Sprintf("/api/conversations?id=%d", conversationID), nil)
		req.Header.Set("Authorization", "Bearer "+tokens[1])
		recorder := httptest.NewRecorder()
		authx.Middleware("test", http.HandlerFunc(s.listConversations)).ServeHTTP(recorder, req)
		if recorder.Code != http.StatusOK {
			t.Fatalf("group list: %d %s", recorder.Code, recorder.Body.String())
		}
		var groups []conversation
		if err := json.Unmarshal(recorder.Body.Bytes(), &groups); err != nil {
			t.Fatal(err)
		}
		if len(groups) != 1 || groups[0].ID != conversationID {
			t.Fatalf("group missing from conversation list: %+v", groups)
		}
		var expected int64
		for _, unread := range channelCounts {
			expected += unread
		}
		if groups[0].UnreadCount != int(expected) {
			t.Fatalf("group unread=%d, sum of channels=%d", groups[0].UnreadCount, expected)
		}
	}
	first := load()
	checkGroupBadge(first)
	for _, ch := range []int64{0, channelA, channelB} {
		if first[ch] != 1 {
			t.Fatalf("channel %d unread %d, want 1", ch, first[ch])
		}
	}
	read := do(1, http.MethodPost, "/api/conversations/test/channel-read", fmt.Sprintf(`{"channelId":%d}`, channelA))
	if read.Code != http.StatusOK {
		t.Fatalf("mark read: %d %s", read.Code, read.Body.String())
	}
	after := load()
	if after[0] != 1 || after[channelA] != 0 || after[channelB] != 1 {
		t.Fatalf("wrong isolation: %+v", after)
	}
	checkGroupBadge(after)
	outsider := do(2, http.MethodPost, "/api/conversations/test/channel-read", fmt.Sprintf(`{"channelId":%d}`, channelB))
	if outsider.Code != http.StatusForbidden {
		t.Fatalf("outsider should be forbidden, got %d", outsider.Code)
	}
	unread := do(1, http.MethodGet, "/api/conversations/unread", "")
	if unread.Code != http.StatusOK {
		t.Fatalf("global unread: %d %s", unread.Code, unread.Body.String())
	}
	var count struct {
		UnreadCount int64 `json:"unreadCount"`
	}
	if err := json.Unmarshal(unread.Body.Bytes(), &count); err != nil {
		t.Fatal(err)
	}
	if count.UnreadCount != 2 {
		t.Fatalf("total unread=%d want 2", count.UnreadCount)
	}
}
