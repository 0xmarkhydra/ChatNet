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
)

func TestStoryActionsIntegration(t *testing.T) {
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

	var users [3]int64
	defer func() {
		for _, id := range users {
			if id != 0 {
				_, _ = db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
			}
		}
	}()
	var names, tokens [3]string
	prefix := fmt.Sprintf("story_action_%d", time.Now().UnixNano())
	for i := range users {
		names[i] = fmt.Sprintf("%s_%d", prefix, i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, names[i]+"@example.invalid", names[i]).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		tokens[i], err = authx.Sign("test", users[i], names[i], names[i])
		if err != nil {
			t.Fatal(err)
		}
	}

	s := &server{db: db}
	mux := http.NewServeMux()
	for pattern, handler := range map[string]http.HandlerFunc{
		"GET /api/stories":                   s.listStories,
		"DELETE /api/stories/{id}":           s.deleteStory,
		"GET /api/stories/{id}/like":         s.getStoryLikes,
		"PUT /api/stories/{id}/like":         s.changeStoryLike,
		"DELETE /api/stories/{id}/like":      s.changeStoryLike,
		"GET /api/stories/highlights":        s.listStoryHighlights,
		"PUT /api/stories/{id}/highlight":    s.changeStoryHighlight,
		"DELETE /api/stories/{id}/highlight": s.changeStoryHighlight,
	} {
		mux.Handle(pattern, authx.Middleware("test", handler))
	}
	call := func(actor int, method, path, body string, want int) []byte {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tokens[actor])
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("%s %s: got %d, want %d (%s)", method, path, res.Code, want, res.Body.String())
		}
		return res.Body.Bytes()
	}
	create := func(text string) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO stories(user_id, kind, text_content, text_background)
			VALUES($1,'text',$2,'berry') RETURNING id`, users[0], text).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	id, ordinaryID := create("Ghim tin"), create("Tin thường")
	storyPath := fmt.Sprintf("/api/stories/%d", id)
	likePath, highlightPath := storyPath+"/like", storyPath+"/highlight"
	listPath := "/api/stories/highlights?username=" + names[0]

	call(1, "PUT", likePath, "", 204)
	call(1, "PUT", likePath, "", 204)
	call(0, "PUT", likePath, "", 404)
	if got := string(call(1, "GET", likePath, "", 200)); strings.TrimSpace(got) != `{"liked":true}` {
		t.Fatalf("liker state: %s", got)
	}
	if got := string(call(2, "GET", likePath, "", 200)); strings.TrimSpace(got) != `{"liked":false}` {
		t.Fatalf("another viewer saw private information: %s", got)
	}
	var own struct{ Likers []storyLiker }
	if err := json.Unmarshal(call(0, "GET", likePath, "", 200), &own); err != nil || len(own.Likers) != 1 || own.Likers[0].ID != users[1] {
		t.Fatalf("owner likes: %+v, %v", own, err)
	}
	call(1, "DELETE", likePath, "", 204)
	call(1, "DELETE", likePath, "", 204)
	if got := string(call(1, "GET", likePath, "", 200)); strings.TrimSpace(got) != `{"liked":false}` {
		t.Fatalf("unlike did not persist: %s", got)
	}

	call(1, "PUT", highlightPath, `{"title":"Không được ghim"}`, 404)
	call(0, "PUT", highlightPath, `{"title":" "}`, 400)
	call(0, "PUT", highlightPath, `{"title":"Chuyến đi"}`, 204)
	call(0, "PUT", highlightPath, `{"title":"Chuyến đi mới"}`, 204)
	if _, err := db.Exec(ctx, "UPDATE stories SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1 OR id=$2", id, ordinaryID); err != nil {
		t.Fatal(err)
	}
	var ordinary []story
	if err := json.Unmarshal(call(1, "GET", "/api/stories?includeText=true", "", 200), &ordinary); err != nil {
		t.Fatal(err)
	}
	for _, item := range ordinary {
		if item.ID == id || item.ID == ordinaryID {
			t.Fatalf("expired story in normal list: %d", item.ID)
		}
	}
	var items []storyHighlight
	if err := json.Unmarshal(call(1, "GET", listPath, "", 200), &items); err != nil || len(items) != 1 || items[0].ID != id || items[0].Title != "Chuyến đi mới" {
		t.Fatalf("highlight should survive expiry with current title: %+v, %v", items, err)
	}
	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", users[2], users[0]); err != nil {
		t.Fatal(err)
	}
	if got := string(call(2, "GET", listPath, "", 200)); strings.TrimSpace(got) != "[]" {
		t.Fatalf("blocked viewer can see highlight: %s", got)
	}
	active := create("Xoá cả ghim")
	activePath := fmt.Sprintf("/api/stories/%d", active)
	call(2, "PUT", activePath+"/like", "", 404)
	call(2, "GET", activePath+"/like", "", 404)
	call(0, "PUT", activePath+"/highlight", `{"title":"Sẽ xoá"}`, 204)
	call(0, "DELETE", activePath, "", 204)
	call(1, "DELETE", highlightPath, "", 404)
	call(0, "DELETE", highlightPath, "", 204)
	if got := string(call(1, "GET", listPath, "", 200)); strings.TrimSpace(got) != "[]" {
		t.Fatalf("removed and deleted highlights still visible: %s", got)
	}
}
