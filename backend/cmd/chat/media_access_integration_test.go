package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"chatnet/internal/database"
	"chatnet/internal/objectstore"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Intentionally opt-in: creates and removes fixture records on the local
// development DB. Never use shared or production databases.
func TestP008LocalIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("P0-08 local integration test is opt-in")
	}
	if getenv := strings.TrimSpace(os.Getenv("CHATNET_P008_LOCAL_E2E")); getenv != "1" {
		t.Skip("set CHATNET_P008_LOCAL_E2E=1 to exercise local PostgreSQL + S3 simulator")
	}
	const dsn = "postgres://chatnet:chatnet@127.0.0.1:5432/chatnet?sslmode=disable"
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := database.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)

	ids := make([]int64, 3)
	stamp := time.Now().UnixNano()
	for i := range ids {
		name := fmt.Sprintf("p008_%d_%d", stamp, i)
		err = db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
   VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i])
		if err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if _, err := db.Exec(cleanup, `DELETE FROM conversations WHERE created_by=$1`, ids[0]); err != nil {
			t.Errorf("fixture conversations cleanup: %v", err)
		}
		for _, id := range ids {
			if _, err := db.Exec(cleanup, `DELETE FROM users WHERE id=$1`, id); err != nil {
				t.Errorf("fixture cleanup: %v", err)
			}
		}
	})
	a, b, c := ids[0], ids[1], ids[2]
	directID := createP008Conversation(t, ctx, db, "direct", a, []int64{a, b})
	groupID := createP008Conversation(t, ctx, db, "group", a, []int64{a, b, c})
	directMessage := createP008Message(t, ctx, db, directID, a)
	groupMessage := createP008Message(t, ctx, db, groupID, a)

	// All fixture objects are in the chat scope. S3 server is an in-memory
	// HTTP simulator: no external bucket or user files are touched.
	keyReferenced := fmt.Sprintf("chatnet/chat/%d/2026/11/reference-p008.txt", a)
	keyOrphan := fmt.Sprintf("chatnet/chat/%d/2026/11/orphan-old-p008.txt", a)
	keyYoung := fmt.Sprintf("chatnet/chat/%d/2026/11/orphan-young-p008.txt", a)
	keyOtherScope := fmt.Sprintf("chatnet/feed/%d/2026/11/feed-not-chat-p008.txt", a)
	ref := "s3://p008-fixture-bucket/" + keyReferenced
	directAttachment := createP008Attachment(t, ctx, db, directMessage, ref)
	groupAttachment := createP008Attachment(t, ctx, db, groupMessage, ref)
	var mu sync.Mutex
	deletes := []string{}
	oldDate := time.Now().Add(-9 * 24 * time.Hour).UTC().Format(time.RFC3339)
	youngDate := time.Now().Add(-24 * time.Hour).UTC().Format(time.RFC3339)
	fakeS3 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("X-Amz-Signature") == "" {
			http.Error(w, "unsigned S3 operation", 403)
			return
		}
		if r.URL.Query().Get("list-type") == "2" {
			if r.URL.Query().Get("prefix") != "chatnet/chat/" {
				http.Error(w, "bad prefix", 400)
				return
			}
			w.Header().Set("Content-Type", "application/xml")
			fmt.Fprintf(w, "<ListBucketResult><Contents><Key>%s</Key><LastModified>%s</LastModified></Contents><Contents><Key>%s</Key><LastModified>%s</LastModified></Contents><Contents><Key>%s</Key><LastModified>%s</LastModified></Contents><Contents><Key>%s</Key><LastModified>%s</LastModified></Contents></ListBucketResult>", keyOrphan, oldDate, keyYoung, youngDate, keyReferenced, oldDate, keyOtherScope, oldDate)
			return
		}
		if r.Method == "DELETE" {
			mu.Lock()
			deletes = append(deletes, r.URL.Path)
			mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != "GET" {
			http.Error(w, "unsupported", 405)
			return
		}
		if !strings.Contains(r.URL.Path, keyReferenced) {
			http.Error(w, "not found", 404)
			return
		}
		data := "p008-media"
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Content-Type", "text/plain")
		if r.Header.Get("Range") == "bytes=0-3" {
			w.Header().Set("Content-Range", "bytes 0-3/10")
			w.Header().Set("Content-Length", "4")
			w.WriteHeader(http.StatusPartialContent)
			_, _ = io.WriteString(w, "p008")
			return
		}
		w.Header().Set("Content-Length", fmt.Sprint(len(data)))
		_, _ = io.WriteString(w, data)
	}))
	defer fakeS3.Close()
	t.Setenv("S3_ENDPOINT", fakeS3.URL)
	t.Setenv("S3_BUCKET", "p008-fixture-bucket")
	t.Setenv("S3_REGION", "us-east-1")
	t.Setenv("S3_ACCESS_KEY_ID", "p008-access")
	t.Setenv("S3_SECRET_ACCESS_KEY", "p008-secret")
	t.Setenv("S3_FORCE_PATH_STYLE", "true")
	storage := objectstore.NewFromEnv()
	s := &server{db: db, jwtSecret: "p008-secret-key", storage: storage}
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/api/media/chat/") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		r.SetPathValue("id", strings.TrimPrefix(r.URL.Path, "/api/media/chat/"))
		s.serveChatMedia(w, r)
	}))
	defer api.Close()
	t.Setenv("MEDIA_PUBLIC_ORIGIN", api.URL)
	fetch := func(label, link, rangeHeader string, want int) string {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, link, nil)
		if err != nil {
			t.Fatal(err)
		}
		if rangeHeader != "" {
			req.Header.Set("Range", rangeHeader)
		}
		response, err := api.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		body, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != want {
			t.Errorf("%s: got %d want %d; body=%s", label, response.StatusCode, want, string(body))
		}
		if !strings.Contains(response.Header.Get("Cache-Control"), "no-store") {
			t.Errorf("%s: missing no-store", label)
		}
		t.Logf("%s: HTTP %d", label, response.StatusCode)
		return string(body)
	}

	directLink := s.mediaTicket(directAttachment, b)
	if got := fetch("direct authorized download", directLink, "", 200); got != "p008-media" {
		t.Errorf("wrong content: %s", got)
	}
	if got := fetch("Range download", directLink, "bytes=0-3", 206); got != "p008" {
		t.Errorf("wrong range: %s", got)
	}
	fetch("direct outsider denied", s.mediaTicket(directAttachment, c), "", 403)
	tampered, err := url.Parse(directLink)
	if err != nil {
		t.Fatal(err)
	}
	tamperedValues := tampered.Query()
	tamperedValues.Set("viewer", fmt.Sprint(c))
	tampered.RawQuery = tamperedValues.Encode()
	fetch("viewer tamper rejected", tampered.String(), "", 403)
	expired := p008ExpiredTicket(s, api.URL, directAttachment, b)
	fetch("expired ticket denied", expired, "", 403)
	fetch("invalid Range denied", directLink, "bytes=0-1,3-4", 416)

	// Bidirectional blocks must invalidate an already-issued signed URL.
	if _, err = db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, b, a); err != nil {
		t.Fatal(err)
	}
	fetch("after recipient blocks sender", directLink, "", 403)
	if _, err = db.Exec(ctx, `DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, b, a); err != nil {
		t.Fatal(err)
	}
	fetch("after unblock", directLink, "", 200)
	if _, err = db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, a, b); err != nil {
		t.Fatal(err)
	}
	fetch("after sender blocks recipient", directLink, "", 403)
	if _, err = db.Exec(ctx, `DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, a, b); err != nil {
		t.Fatal(err)
	}

	groupLink := s.mediaTicket(groupAttachment, c)
	fetch("group member allowed", groupLink, "", 200)
	if _, err = db.Exec(ctx, `DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2`, groupID, c); err != nil {
		t.Fatal(err)
	}
	fetch("after group removal", groupLink, "", 403)
	if _, err = db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,'member')`, groupID, c); err != nil {
		t.Fatal(err)
	}
	fetch("after rejoin", groupLink, "", 200)
	if _, err = db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, c, a); err != nil {
		t.Fatal(err)
	}
	fetch("group sender blocked", groupLink, "", 403)
	if _, err = db.Exec(ctx, `DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, c, a); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE messages SET deleted_at=NOW() WHERE id=$1`, groupMessage); err != nil {
		t.Fatal(err)
	}
	fetch("recalled media denied", groupLink, "", 403)

	s.sweepOrphanChatMedia(ctx)
	mu.Lock()
	deleted := append([]string(nil), deletes...)
	mu.Unlock()
	if len(deleted) != 1 || !strings.HasSuffix(deleted[0], keyOrphan) {
		t.Errorf("orphan cleanup expected only stale unreferenced object, got %v", deleted)
	} else {
		t.Log("cleanup: stale unreferenced deleted; attached and recent objects retained")
	}
}

func createP008Conversation(t *testing.T, ctx context.Context, db *pgxpool.Pool, kind string, owner int64, members []int64) int64 {
	t.Helper()
	var id int64
	var err error
	if kind == "group" {
		err = db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by) VALUES('group','P008 E2E group',$1) RETURNING id`, owner).Scan(&id)
	} else {
		low, high := members[0], members[1]
		if low > high {
			low, high = high, low
		}
		err = db.QueryRow(ctx, `INSERT INTO conversations(type,direct_key,created_by) VALUES('direct',$1,$2) RETURNING id`, fmt.Sprintf("%d:%d", low, high), owner).Scan(&id)
	}
	if err != nil {
		t.Fatal(err)
	}
	for i, uid := range members {
		role := "member"
		if kind == "group" && i == 0 {
			role = "owner"
		}
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,$3)`, id, uid, role); err != nil {
			t.Fatal(err)
		}
	}
	return id
}
func createP008Message(t *testing.T, ctx context.Context, db *pgxpool.Pool, cid, uid int64) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,'[P0-08 synthetic attachment]') RETURNING id`, cid, uid).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}
func createP008Attachment(t *testing.T, ctx context.Context, db *pgxpool.Pool, mid int64, ref string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(ctx, `INSERT INTO message_attachments(message_id,storage_ref,original_name,content_type,size_bytes,kind,position)
 VALUES($1,$2,'p008.txt','text/plain',10,'file',0) RETURNING id`, mid, ref).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}
func p008ExpiredTicket(s *server, origin string, id, viewer int64) string {
	expiry := time.Now().Add(-time.Minute).Unix()
	payload := fmt.Sprintf("chat-media:%d:%d:%d", id, viewer, expiry)
	h := hmac.New(sha256.New, []byte("media-access-v1:"+s.jwtSecret))
	_, _ = h.Write([]byte(payload))
	return fmt.Sprintf("%s/api/media/chat/%d?viewer=%d&expires=%d&sig=%s", strings.TrimRight(origin, "/"), id, viewer, expiry, hex.EncodeToString(h.Sum(nil)))
}
