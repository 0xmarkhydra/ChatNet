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

func TestCommentValidation(t *testing.T) {
	for _, tc := range []struct{ id, body string }{
		{"0", `{"content":"hello"}`},
		{"bad", `{"content":"hello"}`},
		{"1", `{"content":" "}`},
		{"1", `{"content":"hello","parentId":0}`},
		{"1", `{"content":"hello","parentId":-1}`},
		{"1", `{"content":"hello","parentId":"1"}`},
		{"1", `{"content":"hello","unknown":true}`},
		{"1", `{"content":"hello"} {}`},
		{"1", fmt.Sprintf(`{"content":%q}`, strings.Repeat("x", 1001))},
	} {
		r := httptest.NewRequest(http.MethodPost, "/api/posts/"+tc.id+"/comments", strings.NewReader(tc.body))
		r.SetPathValue("id", tc.id)
		w := httptest.NewRecorder()
		(&server{}).addComment(w, r)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("%s %s: got %d", tc.id, tc.body, w.Code)
		}
	}
}

func TestStoryValidation(t *testing.T) {
	token, err := authx.Sign("test", 1, "story_test", "story_test")
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.Handle("POST /api/stories", authx.Middleware("test", http.HandlerFunc((&server{}).createStory)))
	for _, body := range []string{
		``,
		`{}`,
		`{"attachment":{},"unknown":true}`,
		`{"attachment":{}} {}`,
	} {
		r := httptest.NewRequest(http.MethodPost, "/api/stories", strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("%q: got %d", body, w.Code)
		}
	}
	for _, id := range []string{"0", "-1", "bad"} {
		r := httptest.NewRequest(http.MethodDelete, "/api/stories/"+id, nil)
		r.SetPathValue("id", id)
		w := httptest.NewRecorder()
		(&server{}).deleteStory(w, r)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("story id %q: got %d", id, w.Code)
		}
	}
}

// Run only against a disposable database: CHATNET_TEST_DATABASE_URL=... go test ./cmd/feed -v.
func TestCommentThreadIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for i := 0; i < 2; i++ {
		if err := database.Migrate(ctx, db); err != nil {
			t.Fatal(err)
		}
	}
	var uid, postID, otherID int64
	name := fmt.Sprintf("feed_test_%d", time.Now().UnixNano())
	if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'test',$2) RETURNING id`, name+"@example.com", name).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, uid)
	for _, id := range []*int64{&postID, &otherID} {
		if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content) VALUES($1,'test') RETURNING id`, uid).Scan(id); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO post_likes(post_id,user_id) VALUES($1,$2)`, postID, uid); err != nil {
		t.Fatal(err)
	}
	token, err := authx.Sign("test", uid, name, name)
	if err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	mux.Handle("POST /api/posts/{id}/comments", authx.Middleware("test", http.HandlerFunc(s.addComment)))
	call := func(id int64, body string, status int) post {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/posts/%d/comments", id), strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("got %d want %d: %s", w.Code, status, w.Body.String())
		}
		var p post
		if status == http.StatusCreated {
			if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
				t.Fatal(err)
			}
			if !p.Liked {
				t.Fatal("comment reset liked state")
			}
		}
		return p
	}
	p := call(postID, `{"content":"Bình luận gốc"}`, 201)
	root := p.Comments[0].ID
	p = call(postID, fmt.Sprintf(`{"content":"Phản hồi","parentId":%d}`, root), 201)
	reply := p.Comments[1].ID
	p = call(postID, fmt.Sprintf(`{"content":"Trả lời phản hồi","parentId":%d}`, reply), 201)
	if len(p.Comments) != 3 || p.Comments[0].ParentID != nil ||
		p.Comments[1].ParentID == nil || *p.Comments[1].ParentID != root ||
		p.Comments[2].ParentID == nil || *p.Comments[2].ParentID != reply {
		t.Fatalf("incorrect tree: %+v", p.Comments)
	}
	call(otherID, fmt.Sprintf(`{"content":"wrong post","parentId":%d}`, root), 404)
	call(postID, `{"content":"missing","parentId":9223372036854775807}`, 404)
	call(9223372036854775807, `{"content":"missing post"}`, 404)
	call(postID, fmt.Sprintf(`{"content":%q}`, strings.Repeat("ệ", 1000)), 201)
	if _, err := db.Exec(ctx, `INSERT INTO comments(post_id,user_id,content,parent_id) VALUES($1,$2,'invalid',$3)`, otherID, uid, root); err == nil {
		t.Fatal("DB accepted cross-post reply")
	}
	if _, err := db.Exec(ctx, `UPDATE comments SET parent_id=$1 WHERE id=$2`, reply, root); err == nil {
		t.Fatal("DB accepted cyclic parent")
	}
}

func TestStoryExpiryAndOwnershipIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for integration tests")
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

	base := fmt.Sprintf("story_test_%d", time.Now().UnixNano())
	var ownerID, otherID int64
	for index, target := range []*int64{&ownerID, &otherID} {
		username := fmt.Sprintf("%s_%d", base, index)
		if err := db.QueryRow(ctx,
			`INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'test',$2) RETURNING id`,
			username+"@example.com", username,
		).Scan(target); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, *target)
	}

	var activeID, expiredID, otherStoryID int64
	insert := func(userID int64, expires string, target *int64) {
		t.Helper()
		if err := db.QueryRow(ctx, `
			INSERT INTO stories(user_id,storage_ref,original_name,content_type,size_bytes,kind,expires_at)
			VALUES($1,$2,'story.jpg','image/jpeg',100,'image',`+expires+`)
			RETURNING id`, userID, fmt.Sprintf("s3://test/story/%d", time.Now().UnixNano()),
		).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	insert(ownerID, `NOW()+INTERVAL '1 hour'`, &activeID)
	insert(ownerID, `NOW()-INTERVAL '1 second'`, &expiredID)
	insert(otherID, `NOW()+INTERVAL '1 hour'`, &otherStoryID)

	token, err := authx.Sign("test", ownerID, base+"_0", base+"_0")
	if err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	mux.Handle("GET /api/stories", authx.Middleware("test", http.HandlerFunc(s.listStories)))
	mux.Handle("DELETE /api/stories/{id}", authx.Middleware("test", http.HandlerFunc(s.deleteStory)))
	call := func(method, path string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}

	w := call(http.MethodGet, "/api/stories")
	if w.Code != http.StatusOK {
		t.Fatalf("list got %d: %s", w.Code, w.Body.String())
	}
	var items []story
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 || items[0].ID != activeID {
		t.Fatalf("active stories/order incorrect: %+v", items)
	}
	var expiredCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM stories WHERE id=$1`, expiredID).Scan(&expiredCount); err != nil || expiredCount != 0 {
		t.Fatalf("expired story retained: count=%d err=%v", expiredCount, err)
	}
	if got := call(http.MethodDelete, fmt.Sprintf("/api/stories/%d", otherStoryID)); got.Code != http.StatusNotFound {
		t.Fatalf("deleted another user's story: %d", got.Code)
	}
	if got := call(http.MethodDelete, fmt.Sprintf("/api/stories/%d", activeID)); got.Code != http.StatusNoContent {
		t.Fatalf("delete own story got %d: %s", got.Code, got.Body.String())
	}
}
