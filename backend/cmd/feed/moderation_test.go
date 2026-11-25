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

// Uses a disposable PostgreSQL database. A reporter never gains reviewer privileges.
func TestModerationThreeAccountsIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for moderation integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	secret := "moderation-test-secret"
	prefix := fmt.Sprintf("mod_test_%d", time.Now().UnixNano())
	ids := make([]int64, 3)
	tokens := make([]string, 3)
	for i := 0; i < 3; i++ {
		name := fmt.Sprintf("%s_%d", prefix, i)
		err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
            VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i])
		if err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
		tokens[i], err = authx.Sign(secret, ids[i], name, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	// Only user B is a moderator, provisioned by a trusted DB operator.
	if _, err := db.Exec(ctx, "INSERT INTO feed_moderators(user_id) VALUES($1)", ids[1]); err != nil {
		t.Fatal(err)
	}
	var postID, dismissPostID int64
	for _, dst := range []*int64{&postID, &dismissPostID} {
		if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility)
            VALUES($1,'test moderation','public') RETURNING id`, ids[2]).Scan(dst); err != nil {
			t.Fatal(err)
		}
	}
	for _, reporter := range []int64{ids[0], ids[1]} {
		if _, err := db.Exec(ctx, `INSERT INTO feed_reports(reporter_id,target_type,target_id,reason)
            VALUES($1,'post',$2,'Unsafe content')`, reporter, postID); err != nil {
			t.Fatal(err)
		}
	}
	var reportID, dismissID int64
	if err := db.QueryRow(ctx, `SELECT id FROM feed_reports WHERE reporter_id=$1 AND target_id=$2`, ids[0], postID).Scan(&reportID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO feed_reports(reporter_id,target_type,target_id,reason)
        VALUES($1,'post',$2,'Incorrect report') RETURNING id`, ids[0], dismissPostID).Scan(&dismissID); err != nil {
		t.Fatal(err)
	}

	s := &server{db: db}
	mux := http.NewServeMux()
	mux.Handle("GET /api/feed/moderation/me", authx.Middleware(secret, http.HandlerFunc(s.getModerationMe)))
	mux.Handle("GET /api/feed/moderation/reports", authx.Middleware(secret, http.HandlerFunc(s.listModerationReports)))
	mux.Handle("PATCH /api/feed/moderation/reports/{id}", authx.Middleware(secret, http.HandlerFunc(s.reviewModerationReport)))
	mux.Handle("GET /api/posts/{id}", authx.Middleware(secret, http.HandlerFunc(s.detailPost)))
	call := func(actor int, method, path, body string, want int) string {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+tokens[actor])
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("actor %d %s %s: %d want %d: %s", actor, method, path, w.Code, want, w.Body.String())
		}
		return w.Body.String()
	}
	queue := "/api/feed/moderation/reports"
	item := fmt.Sprintf("%s/%d", queue, reportID)
	me0 := call(0, "GET", "/api/feed/moderation/me", "", 200)
	if !strings.Contains(me0, `"moderator":false`) {
		t.Fatalf("actor 0 want moderator false, got: %s", me0)
	}
	me1 := call(1, "GET", "/api/feed/moderation/me", "", 200)
	if !strings.Contains(me1, `"moderator":true`) {
		t.Fatalf("actor 1 want moderator true, got: %s", me1)
	}
	call(0, "GET", queue, "", 403)
	call(2, "PATCH", item, `{"decision":"remove"}`, 403)
	raw := call(1, "GET", queue, "", 200)
	var reports []moderationReport
	if err := json.Unmarshal([]byte(raw), &reports); err != nil {
		t.Fatal(err)
	}
	if len(reports) < 3 {
		t.Fatalf("pending reports not listed: %s", raw)
	}
	for _, report := range reports {
		if report.TargetID == postID && report.Preview != "test moderation" {
			t.Fatalf("moderation evidence missing: %+v", report)
		}
	}
	call(1, "PATCH", item, `{"decision":"ignore"}`, 400)
	call(1, "PATCH", item, `{"decision":"remove"}`, 200)
	call(1, "PATCH", item, `{"decision":"remove"}`, 409)
	call(2, "GET", fmt.Sprintf("/api/posts/%d", postID), "", 404)
	var unresolved int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM feed_reports
        WHERE target_type='post' AND target_id=$1 AND
            (status<>'removed' OR reviewed_by<>$2 OR reviewed_at IS NULL)`, postID, ids[1]).Scan(&unresolved); err != nil {
		t.Fatal(err)
	}
	if unresolved != 0 {
		t.Fatal("duplicate reports were not resolved together or audit data missing")
	}

	call(1, "PATCH", fmt.Sprintf("%s/%d", queue, dismissID), `{"decision":"dismiss"}`, 200)
	call(2, "GET", fmt.Sprintf("/api/posts/%d", dismissPostID), "", 200)
	var dismissed string
	if err := db.QueryRow(ctx, `SELECT status FROM feed_reports WHERE id=$1`, dismissID).Scan(&dismissed); err != nil {
		t.Fatal(err)
	}
	if dismissed != "dismissed" {
		t.Fatalf("expected dismissed decision, got %s", dismissed)
	}
}

func TestModerationStoryRemovalQueuesMediaCleanupIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for story moderation integration")
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

	prefix := fmt.Sprintf("story_moderation_%d", time.Now().UnixNano())
	var ownerID, moderatorID int64
	for index, target := range []*int64{&ownerID, &moderatorID} {
		name := fmt.Sprintf("%s_%d", prefix, index)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'test',$2) RETURNING id`, name+"@example.invalid", name).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id IN ($1,$2)`, ownerID, moderatorID)
	if _, err := db.Exec(ctx, "INSERT INTO feed_moderators(user_id) VALUES($1)", moderatorID); err != nil {
		t.Fatal(err)
	}
	storageRef := "story/moderation/" + prefix + ".jpg"
	defer db.Exec(context.Background(), `DELETE FROM story_media_cleanup WHERE storage_ref=$1`, storageRef)
	var storyID, reportID int64
	if err := db.QueryRow(ctx, `INSERT INTO stories(user_id,storage_ref,original_name,content_type,size_bytes,kind)
		VALUES($1,$2,'story.jpg','image/jpeg',100,'image') RETURNING id`, ownerID, storageRef).Scan(&storyID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO feed_reports(reporter_id,target_type,target_id,reason)
		VALUES($1,'story',$2,'test') RETURNING id`, moderatorID, storyID).Scan(&reportID); err != nil {
		t.Fatal(err)
	}
	token, err := authx.Sign("moderation-test-secret", moderatorID, prefix, prefix)
	if err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	mux.Handle("PATCH /api/feed/moderation/reports/{id}", authx.Middleware("moderation-test-secret", http.HandlerFunc(s.reviewModerationReport)))
	req := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/feed/moderation/reports/%d", reportID), strings.NewReader(`{"decision":"remove"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("moderation removal got %d: %s", res.Code, res.Body.String())
	}
	var stories, cleanupJobs int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM stories WHERE id=$1", storyID).Scan(&stories); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, "SELECT count(*) FROM story_media_cleanup WHERE storage_ref=$1", storageRef).Scan(&cleanupJobs); err != nil {
		t.Fatal(err)
	}
	if stories != 0 || cleanupJobs != 1 {
		t.Fatalf("story rows=%d cleanup jobs=%d", stories, cleanupJobs)
	}
}
