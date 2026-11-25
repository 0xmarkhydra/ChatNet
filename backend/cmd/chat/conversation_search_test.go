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
	"github.com/redis/go-redis/v9"
)

func TestConversationSearchRejectsLongQuery(t *testing.T) {
	w := httptest.NewRecorder()
	(&server{}).listConversations(w, httptest.NewRequest("GET",
		"/api/conversations?limit=5&q="+url.QueryEscape(strings.Repeat("ệ", 121)), nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("search limit: got %d, want 400", w.Code)
	}
}

func TestConversationSearchRejectsInvalidFilters(t *testing.T) {
	for _, query := range []string{"unread=not-a-boolean", "type=channel"} {
		w := httptest.NewRecorder()
		(&server{}).listConversations(w, httptest.NewRequest("GET",
			"/api/conversations?limit=5&"+query, nil))
		if w.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400", query, w.Code)
		}
	}
}

// Uses an isolated/disposable database provided by the test runner.
func TestConversationSearchGlobalIntegration(t *testing.T) {
	uri := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("CHATNET_TEST_DATABASE_URL must point to a disposable database/schema")
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
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:6379"})
	defer rdb.Close()
	s := &server{db: db, redis: rdb}
	prefix := fmt.Sprintf("convo_search_%d", time.Now().UnixNano())
	users := make([]int64, 2)
	for i := range users {
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'test',$3) RETURNING id`, fmt.Sprintf("%s_%d@example.invalid", prefix, i),
			fmt.Sprintf("%s_%d", prefix, i), fmt.Sprintf("Display %s %d Nguyễn Văn", prefix, i)).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		id := users[i]
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
	}
	conversations := []int64{}
	create := func(typ, name string, includeOther bool) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by)
			VALUES($1,$2,$3) RETURNING id`, typ, name, users[0]).Scan(&id); err != nil {
			t.Fatal(err)
		}
		conversations = append(conversations, id)
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)`, id, users[0]); err != nil {
			t.Fatal(err)
		}
		if includeOther {
			if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)`, id, users[1]); err != nil {
				t.Fatal(err)
			}
		}
		return id
	}
	defer func() {
		for _, id := range conversations {
			db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", id)
		}
	}()
	old := create("direct", "", true)
	if _, err := db.Exec(ctx, `INSERT INTO messages(conversation_id,user_id,text)
		VALUES($1,$2,$3),($1,$2,'recent unrelated')`, old, users[1], "Tìm kiếm nội dung "+prefix+" historic_"+prefix); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 28; i++ {
		create("group", fmt.Sprintf("unrelated_%02d", i), false)
	}
	named := create("group", "Kế hoạch "+prefix+" topic_"+prefix, false)
	hidden := create("group", "topic_"+prefix, false)
	if _, err := db.Exec(ctx, "DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2", hidden, users[0]); err != nil {
		t.Fatal(err)
	}
	token, err := authx.Sign("test", users[0], prefix+"_0", prefix+"_0")
	if err != nil {
		t.Fatal(err)
	}
	list := func(q string, offset int, filters ...string) []conversation {
		t.Helper()
		path := fmt.Sprintf("/api/conversations?limit=5&q=%s&offset=%d", url.QueryEscape(q), offset)
		for _, filter := range filters {
			path += "&" + filter
		}
		req := httptest.NewRequest("GET", path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		authx.Middleware("test", http.HandlerFunc(s.listConversations)).ServeHTTP(w, req)
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
		var result []conversation
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	if result := list("historic_"+prefix, 0); len(result) != 1 || result[0].ID != old {
		t.Fatalf("historical message not searchable: %+v", result)
	}
	if result := list(prefix+"_1", 0); len(result) != 1 || result[0].ID != old {
		t.Fatalf("username not searchable: %+v", result)
	}
	if result := list("Display "+prefix+" 1", 0); len(result) != 1 || result[0].ID != old {
		t.Fatalf("display name not searchable: %+v", result)
	}
	if result := list("tim kiem noi dung "+prefix, 0); len(result) != 1 || result[0].ID != old {
		t.Fatalf("accent-insensitive historical message search failed: %+v", result)
	}
	if result := list("nguyen van", 0); len(result) != 1 || result[0].ID != old {
		t.Fatalf("accent-insensitive participant name search failed: %+v", result)
	}
	if result := list("ke hoach "+prefix, 0); len(result) != 1 || result[0].ID != named {
		t.Fatalf("accent-insensitive group search failed: %+v", result)
	}
	if result := list("topic_"+prefix, 0); len(result) != 1 || result[0].ID != named {
		t.Fatalf("non-member conversation leaked: %+v", result)
	}
	first := list("unrelated_", 0)
	second := list("unrelated_", 5)
	if len(first) != 5 || len(second) != 5 || first[4].ID == second[0].ID {
		t.Fatalf("pagination repeated or truncated: first=%+v second=%+v", first, second)
	}
	if result := list("historic_"+prefix, 0, "unread=true"); len(result) != 1 || result[0].ID != old {
		t.Fatalf("unread search should include matching unread conversation: %+v", result)
	}
	if result := list("unrelated_", 0, "unread=true"); len(result) != 0 {
		t.Fatalf("unread filter should be applied before pagination: %+v", result)
	}
	if result := list("historic_"+prefix, 0, "type=group"); len(result) != 0 {
		t.Fatalf("group filter returned direct conversation: %+v", result)
	}
	if result := list("unrelated_", 0, "type=group"); len(result) != 5 {
		t.Fatalf("group search pagination failed: %+v", result)
	}
}
