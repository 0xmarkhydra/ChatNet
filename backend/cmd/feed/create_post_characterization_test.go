package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"chatnet/internal/mediax"
	"chatnet/internal/objectstore"
	"chatnet/internal/onesignalx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const feedCreateCharacterizationSecret = "feed-create-characterization-test-secret"

func feedCreateCharacterizationHandler(s *server) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("POST /api/posts", authx.Middleware(feedCreateCharacterizationSecret, http.HandlerFunc(s.create)))
	return mux
}

func feedCreateCharacterizationRequest(t *testing.T, handler http.Handler, userID int64, body string) *httptest.ResponseRecorder {
	t.Helper()
	token, err := authx.Sign(feedCreateCharacterizationSecret, userID, fmt.Sprintf("feed_user_%d", userID), "Feed User")
	if err != nil {
		t.Fatal(err)
	}
	return feedCreateCharacterizationRequestWithToken(handler, token, body)
}

func feedCreateCharacterizationRequestWithToken(handler http.Handler, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/posts", strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

type feedCreateCharacterizationRoundTripper func(*http.Request) (*http.Response, error)

func (roundTrip feedCreateCharacterizationRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return roundTrip(req)
}

func TestCreatePostRequiresAuthAndPreservesInputErrors(t *testing.T) {
	handler := feedCreateCharacterizationHandler(&server{})
	if got := feedCreateCharacterizationRequestWithToken(handler, "", `{}`); got.Code != http.StatusUnauthorized {
		t.Fatalf("missing token status=%d, want %d", got.Code, http.StatusUnauthorized)
	}

	overLimitContent := `{"content":"` + strings.Repeat("x", 64<<10) + `"}`
	longUnicodeBody, err := json.Marshal(struct {
		Content string `json:"content"`
	}{Content: strings.Repeat("😀", 5001)})
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name string
		body string
	}{
		{name: "invalid JSON", body: `{"content":`},
		{name: "unknown field", body: `{"content":"hello","unexpected":true}`},
		{name: "body limit", body: overLimitContent},
		{name: "invalid visibility", body: `{"content":"hello","visibility":"followers"}`},
		{name: "invalid background", body: `{"content":"hello","background":"url(https://example.invalid)"}`},
		{name: "rune limit", body: string(longUnicodeBody)},
		{name: "empty post", body: `{"content":"  "}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := feedCreateCharacterizationRequest(t, handler, 71001, tc.body)
			if got.Code != http.StatusBadRequest {
				t.Fatalf("status=%d, want %d; body=%s", got.Code, http.StatusBadRequest, got.Body.String())
			}
		})
	}
}

func TestCreatePostRateLimitRunsBeforeJSONDecode(t *testing.T) {
	addr := strings.TrimSpace(os.Getenv("CHATNET_TEST_REDIS_ADDR"))
	if addr == "" {
		t.Skip("set CHATNET_TEST_REDIS_ADDR to an isolated Redis instance")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	rdb := redis.NewClient(&redis.Options{Addr: addr})
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatal(err)
	}

	userID := time.Now().UnixNano()
	subject := strconv.FormatInt(userID, 10)
	bucket := time.Now().Unix() / 600
	rateKeys := []string{
		fmt.Sprintf("chatnet:rate:feed:post:%d:%s", bucket-1, subject),
		fmt.Sprintf("chatnet:rate:feed:post:%d:%s", bucket, subject),
		fmt.Sprintf("chatnet:rate:feed:post:%d:%s", bucket+1, subject),
	}
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), time.Second)
		defer cleanupCancel()
		if err := rdb.Del(cleanupCtx, rateKeys...).Err(); err != nil {
			t.Errorf("delete test rate-limit keys: %v", err)
		}
	}()
	handler := feedCreateCharacterizationHandler(&server{redis: rdb})
	for attempt := 1; attempt <= 13; attempt++ {
		got := feedCreateCharacterizationRequest(t, handler, userID, `{`)
		want := http.StatusBadRequest
		if attempt == 13 {
			want = http.StatusTooManyRequests
		}
		if got.Code != want {
			t.Fatalf("attempt %d status=%d, want %d; body=%s", attempt, got.Code, want, got.Body.String())
		}
		if attempt == 13 && got.Header().Get("Retry-After") != "600" {
			t.Fatalf("Retry-After=%q, want 600", got.Header().Get("Retry-After"))
		}
	}
}

func TestCreatePostAttachmentChecksUseOwnerAndStorageMetadata(t *testing.T) {
	const userID int64 = 71002

	t.Run("rejects another users ref before storage lookup", func(t *testing.T) {
		store, headCalls := newFeedCreateCharacterizationStore(t, http.StatusOK, "image/png", 12)
		body := feedCreateCharacterizationBody(t, "photo", []mediax.AttachmentInput{{
			StorageRef: feedCreateCharacterizationRef(userID+1, "photo.png"),
			Name:       "photo.png",
		}})
		got := feedCreateCharacterizationRequest(t, feedCreateCharacterizationHandler(&server{storage: store}), userID, body)
		if got.Code != http.StatusBadRequest || headCalls.Load() != 0 {
			t.Fatalf("status=%d HEAD calls=%d; want 400 and no storage request", got.Code, headCalls.Load())
		}
	})

	t.Run("rejects duplicate storage refs", func(t *testing.T) {
		store, headCalls := newFeedCreateCharacterizationStore(t, http.StatusOK, "image/png", 12)
		ref := feedCreateCharacterizationRef(userID, "duplicate.png")
		body := feedCreateCharacterizationBody(t, "photo", []mediax.AttachmentInput{{StorageRef: ref, Name: "photo.png"}, {StorageRef: ref, Name: "again.png"}})
		got := feedCreateCharacterizationRequest(t, feedCreateCharacterizationHandler(&server{storage: store}), userID, body)
		if got.Code != http.StatusBadRequest || headCalls.Load() != 1 {
			t.Fatalf("status=%d HEAD calls=%d; want 400 and one storage request", got.Code, headCalls.Load())
		}
	})

	t.Run("rejects type from object metadata", func(t *testing.T) {
		store, headCalls := newFeedCreateCharacterizationStore(t, http.StatusOK, "text/plain", 12)
		body := feedCreateCharacterizationBody(t, "photo", []mediax.AttachmentInput{{
			StorageRef:  feedCreateCharacterizationRef(userID, "photo.png"),
			Name:        "photo.png",
			ContentType: "image/png",
			SizeBytes:   12,
			Kind:        "image",
		}})
		got := feedCreateCharacterizationRequest(t, feedCreateCharacterizationHandler(&server{storage: store}), userID, body)
		if got.Code != http.StatusBadRequest || headCalls.Load() != 1 {
			t.Fatalf("status=%d HEAD calls=%d; want 400 after metadata lookup", got.Code, headCalls.Load())
		}
	})

	t.Run("rejects missing object", func(t *testing.T) {
		store, headCalls := newFeedCreateCharacterizationStore(t, http.StatusNotFound, "image/png", 12)
		body := feedCreateCharacterizationBody(t, "photo", []mediax.AttachmentInput{{
			StorageRef: feedCreateCharacterizationRef(userID, "missing.png"),
			Name:       "missing.png",
		}})
		got := feedCreateCharacterizationRequest(t, feedCreateCharacterizationHandler(&server{storage: store}), userID, body)
		if got.Code != http.StatusBadRequest || headCalls.Load() != 1 {
			t.Fatalf("status=%d HEAD calls=%d; want 400 after one storage request", got.Code, headCalls.Load())
		}
	})

	t.Run("enforces attachment count before lookup", func(t *testing.T) {
		store, headCalls := newFeedCreateCharacterizationStore(t, http.StatusOK, "image/png", 12)
		attachments := make([]mediax.AttachmentInput, mediax.MaxFeedAttachments+1)
		for i := range attachments {
			attachments[i] = mediax.AttachmentInput{StorageRef: feedCreateCharacterizationRef(userID, fmt.Sprintf("%d.png", i)), Name: fmt.Sprintf("%d.png", i)}
		}
		body := feedCreateCharacterizationBody(t, "photo", attachments)
		got := feedCreateCharacterizationRequest(t, feedCreateCharacterizationHandler(&server{storage: store}), userID, body)
		if got.Code != http.StatusBadRequest || headCalls.Load() != 0 {
			t.Fatalf("status=%d HEAD calls=%d; want 400 and no storage request", got.Code, headCalls.Load())
		}
	})
}

func TestCreatePostPersistsTrimmedDefaultsMentionsAndAttachments(t *testing.T) {
	db := openFeedCreateCharacterizationDB(t)
	ctx := context.Background()
	authorID, _ := insertFeedCreateCharacterizationUser(t, db, "author")
	allowedID, allowed := insertFeedCreateCharacterizationUser(t, db, "allowed")
	blockedID, blocked := insertFeedCreateCharacterizationUser(t, db, "blocked")
	for _, recipientID := range []int64{allowedID, blockedID} {
		low, high := authorID, recipientID
		if low > high {
			low, high = high, low
		}
		if _, err := db.Exec(ctx, `INSERT INTO friend_connections(user_low,user_high,requested_by,status) VALUES($1,$2,$3,'accepted')`, low, high, authorID); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, authorID, blockedID); err != nil {
		t.Fatal(err)
	}

	s := &server{db: db}
	handler := feedCreateCharacterizationHandler(s)
	created := feedCreateCharacterizationRequest(t, handler, authorID, `{"content":"  hello feed  "}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("text post status=%d; body=%s", created.Code, created.Body.String())
	}
	var textPost post
	if err := json.Unmarshal(created.Body.Bytes(), &textPost); err != nil {
		t.Fatal(err)
	}
	if textPost.Content != "hello feed" || textPost.Visibility != "public" || len(textPost.Comments) != 0 {
		t.Fatalf("text post response changed: %+v", textPost)
	}
	mentionContent := fmt.Sprintf("👥 Cùng với @%s, @%s\npost body", allowed, blocked)
	mentioned := feedCreateCharacterizationRequest(t, handler, authorID, feedCreateCharacterizationBody(t, mentionContent, nil))
	if mentioned.Code != http.StatusCreated {
		t.Fatalf("mention post status=%d; body=%s", mentioned.Code, mentioned.Body.String())
	}
	var mentionPost post
	if err := json.Unmarshal(mentioned.Body.Bytes(), &mentionPost); err != nil {
		t.Fatal(err)
	}
	var gotMentionIDs []int64
	rows, err := db.Query(ctx, `SELECT user_id FROM post_mentions WHERE post_id=$1 ORDER BY user_id`, mentionPost.ID)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			t.Fatal(err)
		}
		gotMentionIDs = append(gotMentionIDs, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		t.Fatal(err)
	}
	rows.Close()
	if len(gotMentionIDs) != 1 || gotMentionIDs[0] != allowedID {
		t.Fatalf("mention recipients=%v, want only accepted unblocked friend %d", gotMentionIDs, allowedID)
	}
	privateContent := fmt.Sprintf("👥 Cùng với @%s\nprivate body", allowed)
	privatePost := feedCreateCharacterizationRequest(t, handler, authorID, feedCreateCharacterizationBody(t, privateContent, nil, "private"))
	if privatePost.Code != http.StatusCreated {
		t.Fatalf("private post status=%d; body=%s", privatePost.Code, privatePost.Body.String())
	}
	var private post
	if err := json.Unmarshal(privatePost.Body.Bytes(), &private); err != nil {
		t.Fatal(err)
	}
	var privateMentionCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM post_mentions WHERE post_id=$1`, private.ID).Scan(&privateMentionCount); err != nil {
		t.Fatal(err)
	}
	if privateMentionCount != 0 {
		t.Fatalf("private post mention rows=%d, want 0", privateMentionCount)
	}

	store, _ := newFeedCreateCharacterizationStore(t, http.StatusOK, "image/png", 321)
	s.storage = store
	attachmentContent := feedCreateCharacterizationBody(t, "", []mediax.AttachmentInput{{
		StorageRef:  feedCreateCharacterizationRef(authorID, "photo.png"),
		Name:        "photo.png",
		ContentType: "text/plain",
		SizeBytes:   -1,
		Kind:        "file",
	}})
	attached := feedCreateCharacterizationRequest(t, handler, authorID, attachmentContent)
	if attached.Code != http.StatusCreated {
		t.Fatalf("attachment-only post status=%d; body=%s", attached.Code, attached.Body.String())
	}
	var attachmentPost post
	if err := json.Unmarshal(attached.Body.Bytes(), &attachmentPost); err != nil {
		t.Fatal(err)
	}
	if attachmentPost.Content != "" || len(attachmentPost.Attachments) != 1 || attachmentPost.Attachments[0].SizeBytes != 321 || attachmentPost.Attachments[0].ContentType != "image/png" || attachmentPost.Attachments[0].Kind != "image" {
		t.Fatalf("attachment response ignored storage metadata incorrectly: %+v", attachmentPost)
	}
	var attachmentRows int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM post_attachments WHERE post_id=$1`, attachmentPost.ID).Scan(&attachmentRows); err != nil {
		t.Fatal(err)
	}
	if attachmentRows != 1 {
		t.Fatalf("stored attachment rows=%d, want 1", attachmentRows)
	}

}

func TestCreatePostPushesMentionsOnlyAfterCommit(t *testing.T) {
	db := openFeedCreateCharacterizationDB(t)
	authorID, _ := insertFeedCreateCharacterizationUser(t, db, "push-author")
	recipientID, recipient := insertFeedCreateCharacterizationUser(t, db, "push-recipient")
	low, high := authorID, recipientID
	if low > high {
		low, high = high, low
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO friend_connections(user_low,user_high,requested_by,status) VALUES($1,$2,$3,'accepted')`, low, high, authorID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO push_subscriptions(subscription_id,user_id) VALUES(gen_random_uuid(),$1)`, recipientID); err != nil {
		t.Fatal(err)
	}
	content := fmt.Sprintf("👥 Cùng với @%s\npush-order fixture", recipient)

	type pushObservation struct {
		postID       int64
		mentionCount int
	}
	observed := make(chan pushObservation, 1)
	previousTransport := http.DefaultTransport
	http.DefaultTransport = feedCreateCharacterizationRoundTripper(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodPost || req.URL.Host != "api.onesignal.com" || req.URL.Path != "/notifications" {
			return nil, fmt.Errorf("unexpected push request %s %s", req.Method, req.URL)
		}
		var result pushObservation
		if err := db.QueryRow(context.Background(), `
			SELECT p.id, count(m.user_id)
			FROM posts p
			LEFT JOIN post_mentions m ON m.post_id=p.id AND m.user_id=$2
			WHERE p.user_id=$1 AND p.content=$3
			GROUP BY p.id`, authorID, recipientID, content).Scan(&result.postID, &result.mentionCount); err != nil {
			observed <- pushObservation{}
			return nil, fmt.Errorf("push began before post transaction committed: %w", err)
		}
		observed <- result
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"id":"test"}`)),
			Request:    req,
		}, nil
	})
	t.Cleanup(func() { http.DefaultTransport = previousTransport })

	s := &server{db: db, push: onesignalx.New("test-app", "test-key")}
	handler := feedCreateCharacterizationHandler(s)
	body := fmt.Sprintf(`{"content":%q}`, content)
	created := feedCreateCharacterizationRequest(t, handler, authorID, body)
	if created.Code != http.StatusCreated {
		t.Fatalf("post status=%d; body=%s", created.Code, created.Body.String())
	}
	var createdPost post
	if err := json.Unmarshal(created.Body.Bytes(), &createdPost); err != nil {
		t.Fatal(err)
	}
	select {
	case result := <-observed:
		if result.postID != createdPost.ID || result.mentionCount != 1 {
			t.Fatalf("push observed post=%d mentions=%d; want committed post %d with one mention", result.postID, result.mentionCount, createdPost.ID)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for post mention push")
	}
}

func TestCreatePostRollsBackWhenMentionPersistenceFails(t *testing.T) {
	db := openFeedCreateCharacterizationDB(t)
	authorID, authorName := insertFeedCreateCharacterizationUser(t, db, "rollback-author")
	recipientID, recipient := insertFeedCreateCharacterizationUser(t, db, "rollback-recipient")
	low, high := authorID, recipientID
	if low > high {
		low, high = high, low
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO friend_connections(user_low,user_high,requested_by,status) VALUES($1,$2,$3,'accepted')`, low, high, authorID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO push_subscriptions(subscription_id,user_id) VALUES(gen_random_uuid(),$1)`, recipientID); err != nil {
		t.Fatal(err)
	}
	pushAttempted := make(chan struct{}, 1)
	previousTransport := http.DefaultTransport
	http.DefaultTransport = feedCreateCharacterizationRoundTripper(func(req *http.Request) (*http.Response, error) {
		if req.URL.Host != "api.onesignal.com" {
			return previousTransport.RoundTrip(req)
		}
		pushAttempted <- struct{}{}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"id":"test"}`)),
			Request:    req,
		}, nil
	})
	t.Cleanup(func() { http.DefaultTransport = previousTransport })

	suffix := strconv.FormatInt(time.Now().UnixNano(), 10)
	functionName := "feed_create_fail_mentions_" + suffix
	triggerName := "feed_create_fail_mentions_trigger_" + suffix
	pushLockKey := time.Now().UnixNano()
	pushLockConn, err := db.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pushLockConn.Exec(context.Background(), "SELECT pg_advisory_lock($1)", pushLockKey); err != nil {
		pushLockConn.Release()
		t.Fatal(err)
	}
	defer func() {
		if _, err := pushLockConn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", pushLockKey); err != nil {
			t.Errorf("release push-order advisory lock: %v", err)
		}
		pushLockConn.Release()
	}()
	_, err = db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM posts WHERE id=NEW.post_id AND user_id=%d) THEN
    PERFORM pg_advisory_xact_lock(%d);
    RAISE EXCEPTION 'forced feed create test failure';
  END IF;
  RETURN NEW;
END;
$$`, functionName, authorID, pushLockKey))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = db.Exec(context.Background(), "DROP TRIGGER IF EXISTS "+triggerName+" ON post_mentions")
		_, _ = db.Exec(context.Background(), "DROP FUNCTION IF EXISTS "+functionName+"()")
	}()
	if _, err := db.Exec(context.Background(), "CREATE TRIGGER "+triggerName+" AFTER INSERT ON post_mentions FOR EACH ROW EXECUTE FUNCTION "+functionName+"()"); err != nil {
		t.Fatal(err)
	}

	store, _ := newFeedCreateCharacterizationStore(t, http.StatusOK, "image/png", 321)
	handler := feedCreateCharacterizationHandler(&server{db: db, storage: store, push: onesignalx.New("test-app", "test-key")})
	rollbackRef := feedCreateCharacterizationRef(authorID, "rollback.png")
	body := feedCreateCharacterizationBody(t, fmt.Sprintf("👥 Cùng với @%s\nrollback body", recipient), []mediax.AttachmentInput{{
		StorageRef: rollbackRef,
		Name:       "rollback.png",
	}})
	token, err := authx.Sign(feedCreateCharacterizationSecret, authorID, authorName, "Feed User")
	if err != nil {
		t.Fatal(err)
	}
	handlerDone := make(chan *httptest.ResponseRecorder, 1)
	go func() { handlerDone <- feedCreateCharacterizationRequestWithToken(handler, token, body) }()
	lockDeadline := time.Now().Add(5 * time.Second)
	for {
		var waiting bool
		if err := db.QueryRow(context.Background(), `SELECT EXISTS (
			SELECT 1 FROM pg_locks
			WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid AND objsubid=1 AND NOT granted
		)`, int64(uint64(pushLockKey)>>32), int64(uint32(pushLockKey))).Scan(&waiting); err != nil {
			t.Fatal(err)
		}
		if waiting {
			break
		}
		if time.Now().After(lockDeadline) {
			t.Fatal("timed out waiting for rollback trigger advisory lock")
		}
		select {
		case got := <-handlerDone:
			t.Fatalf("handler returned before rollback trigger blocked: status=%d", got.Code)
		case <-pushAttempted:
			t.Fatal("push sent before post transaction completed")
		case <-time.After(10 * time.Millisecond):
		}
	}
	select {
	case <-pushAttempted:
		t.Fatal("push sent while post transaction waited before rollback")
	case <-time.After(250 * time.Millisecond):
	}
	if _, err := pushLockConn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", pushLockKey); err != nil {
		t.Fatal(err)
	}
	got := <-handlerDone
	if got.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d, want %d; body=%s", got.Code, http.StatusInternalServerError, got.Body.String())
	}
	select {
	case <-pushAttempted:
		t.Fatal("push sent after post transaction rolled back")
	case <-time.After(time.Second):
	}

	var postCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM posts WHERE user_id=$1`, authorID).Scan(&postCount); err != nil {
		t.Fatal(err)
	}
	if postCount != 0 {
		t.Fatalf("partial post rows=%d after mention failure, want 0", postCount)
	}
	var attachmentCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM post_attachments WHERE storage_ref=$1`, rollbackRef).Scan(&attachmentCount); err != nil {
		t.Fatal(err)
	}
	if attachmentCount != 0 {
		t.Fatalf("partial attachment rows=%d after mention failure, want 0", attachmentCount)
	}
	var mentionCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM post_mentions WHERE user_id=$1`, recipientID).Scan(&mentionCount); err != nil {
		t.Fatal(err)
	}
	if mentionCount != 0 {
		t.Fatalf("partial mention rows=%d after mention failure, want 0", mentionCount)
	}
}

func openFeedCreateCharacterizationDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("CHATNET_TEST_DATABASE_URL"))
	if dsn == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to an isolated PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(ctx, db); err != nil {
		db.Close()
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	return db
}

func insertFeedCreateCharacterizationUser(t *testing.T, db *pgxpool.Pool, label string) (int64, string) {
	t.Helper()
	username := fmt.Sprintf("feed_create_%s_%d", label, time.Now().UnixNano())
	var id int64
	if err := db.QueryRow(context.Background(), `INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!',$3) RETURNING id`, username+"@example.invalid", username, label).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, id)
	})
	return id, username
}

func feedCreateCharacterizationBody(t *testing.T, content string, attachments []mediax.AttachmentInput, visibility ...string) string {
	t.Helper()
	body := struct {
		Content         string                   `json:"content"`
		Visibility      string                   `json:"visibility,omitempty"`
		Attachments     []mediax.AttachmentInput `json:"attachments,omitempty"`
		PublishLocation *postLocation            `json:"publishLocation,omitempty"`
	}{Content: content, Attachments: attachments}
	if len(visibility) > 0 {
		body.Visibility = visibility[0]
	}
	if body.Visibility == "" || body.Visibility == "public" {
		latitude, longitude, accuracy := 21.02, 105.83, 5.0
		body.PublishLocation = &postLocation{
			Latitude:   &latitude,
			Longitude:  &longitude,
			Accuracy:   &accuracy,
			CapturedAt: time.Now(),
		}
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	return string(encoded)
}

func feedCreateCharacterizationRef(userID int64, name string) string {
	return fmt.Sprintf("s3://feed-create-test/chatnet/feed/%d/2026/11/%s", userID, name)
}

func newFeedCreateCharacterizationStore(t *testing.T, status int, contentType string, size int64) (*objectstore.Client, *atomic.Int32) {
	t.Helper()
	var headCalls atomic.Int32
	storage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			http.Error(w, "unexpected method", http.StatusMethodNotAllowed)
			return
		}
		headCalls.Add(1)
		if status != http.StatusOK {
			w.WriteHeader(status)
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
		w.WriteHeader(status)
	}))
	t.Cleanup(storage.Close)
	t.Setenv("S3_ENDPOINT", storage.URL)
	t.Setenv("S3_BUCKET", "feed-create-test")
	t.Setenv("S3_REGION", "us-east-1")
	t.Setenv("S3_ACCESS_KEY_ID", "test-only-access-key")
	t.Setenv("S3_SECRET_ACCESS_KEY", "test-only-secret-key")
	t.Setenv("S3_FORCE_PATH_STYLE", "true")
	return objectstore.NewFromEnv(), &headCalls
}
