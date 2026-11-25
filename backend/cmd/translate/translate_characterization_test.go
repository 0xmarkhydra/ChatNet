package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"chatnet/internal/ratelimit"
	"github.com/redis/go-redis/v9"
)

func TestTranslateCharacterizationHTTP(t *testing.T) {
	const valid = "{\"text\":\"hello\",\"target\":\"vi\"}"
	const secret = "translate-characterization-fixture"
	token, err := authx.Sign(secret, 1, "fixture", "Fixture")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name      string
		body      string
		anonymous bool
		configure func(*server)
		upstream  int
		want      int
		calls     int32
	}{
		{name: "unauthenticated", body: valid, anonymous: true, want: 401},
		{name: "unknown field", body: "{\"text\":\"hello\",\"target\":\"vi\",\"extra\":true}", want: 400},
		{name: "target required", body: "{\"text\":\"hello\"}", want: 400},
		{name: "target invalid", body: "{\"text\":\"hello\",\"target\":\"not-a-language\"}", want: 400},
		{name: "blank text", body: "{\"text\":\"  \",\"target\":\"vi\"}", want: 400},
		{name: "oversize", body: "{\"text\":\"" + strings.Repeat("a", 8001) + "\",\"target\":\"vi\"}", want: 400},
		{name: "missing configuration", body: valid, configure: func(s *server) { s.apiKey = "" }, want: 503},
		{name: "limiter unavailable", body: valid, configure: func(s *server) { s.rateLimitEnabled = true }, want: 503},
		{name: "provider busy", body: valid, configure: func(s *server) { s.providerSlots <- struct{}{} }, want: 503},
		{name: "provider failure", body: valid, upstream: 502, want: 502, calls: 1},
		{name: "success", body: "{\"text\":\" hello \",\"target\":\" VI \"}", want: 200, calls: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				if tc.upstream != 0 {
					http.Error(w, "fixture provider failure", tc.upstream)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte("{\"output_text\":\"Xin chao\"}"))
			}))
			defer upstream.Close()
			s := &server{
				apiKey: "fixture-key", baseURL: upstream.URL, model: "fixture-model",
				apiStyle: "responses", provider: "fixture", authHeader: "Authorization",
				authScheme: "Bearer", client: upstream.Client(), providerSlots: make(chan struct{}, 1),
			}
			if tc.configure != nil {
				tc.configure(s)
			}
			req := httptest.NewRequest(http.MethodPost, "/api/translate", strings.NewReader(tc.body))
			if !tc.anonymous {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			res := httptest.NewRecorder()
			authx.Middleware(secret, http.HandlerFunc(s.translate)).ServeHTTP(res, req)
			if res.Code != tc.want {
				t.Fatalf("status=%d want=%d body=%s", res.Code, tc.want, res.Body.String())
			}
			if tc.want == http.StatusOK {
				var body map[string]string
				if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if body["translatedText"] != "Xin chao" || body["provider"] != "fixture" || body["model"] != "fixture-model" || body["cache"] != "miss" || body["apiStyle"] != "responses" {
					t.Fatalf("unexpected response: %v", body)
				}
			}
			if calls.Load() != tc.calls {
				t.Fatalf("provider calls=%d want=%d", calls.Load(), tc.calls)
			}
		})
	}
}

// Uses only the integration databases provided by the disposable CI environment.
func TestTranslateMembershipCacheQuotaIntegration(t *testing.T) {
	dsn := os.Getenv("CHATNET_TEST_DATABASE_URL")
	redisURL := os.Getenv("CHATNET_TEST_REDIS_URL")
	if redisURL == "" && os.Getenv("CHATNET_TEST_REDIS_ADDR") != "" {
		redisURL = "redis://" + os.Getenv("CHATNET_TEST_REDIS_ADDR") + "/0"
	}
	if dsn == "" || redisURL == "" {
		t.Skip("requires disposable PostgreSQL and Redis fixtures")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := database.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(options)
	t.Cleanup(func() { _ = rdb.Close() })
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatal(err)
	}

	var users []int64
	var cid, mid int64
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if cid != 0 {
			if _, err := db.Exec(cleanup, "DELETE FROM conversations WHERE id=$1", cid); err != nil {
				t.Errorf("fixture conversation cleanup: %v", err)
			}
		}
		for _, uid := range users {
			if _, err := db.Exec(cleanup, "DELETE FROM users WHERE id=$1", uid); err != nil {
				t.Errorf("fixture user cleanup: %v", err)
			}
		}
	})
	stamp := time.Now().UnixNano()
	for i := 0; i < 6; i++ {
		name := fmt.Sprintf("st_%d_%d", stamp, i)
		var id int64
		if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!',$2) RETURNING id", name+"@example.invalid", name).Scan(&id); err != nil {
			t.Fatal(err)
		}
		users = append(users, id)
	}
	if err := db.QueryRow(ctx, "INSERT INTO conversations(type,name,created_by) VALUES('group','Translate fixture',$1) RETURNING id", users[0]).Scan(&cid); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,'owner')", cid, users[0]); err != nil {
		t.Fatal(err)
	}
	source := fmt.Sprintf("translate fixture %d", stamp)
	if err := db.QueryRow(ctx, "INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,$3) RETURNING id", cid, users[0], source).Scan(&mid); err != nil {
		t.Fatal(err)
	}

	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("{\"output_text\":\"Xin chao\"}"))
	}))
	defer upstream.Close()
	s := &server{
		db: db, redis: rdb, limiter: ratelimit.Limiter{Redis: rdb}, rateLimitEnabled: true,
		apiKey: "fixture-key", baseURL: upstream.URL, model: "fixture-model",
		apiStyle: "responses", provider: "fixture", authHeader: "Authorization",
		authScheme: "Bearer", client: upstream.Client(),
	}
	cacheKeys := []string{s.cacheKey(source, "vi")}
	ipNonce := users[0]%254 + 1
	primaryIP := fmt.Sprintf("192.0.2.%d", ipNonce)
	quotaIP := fmt.Sprintf("203.0.113.%d", ipNonce)
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		if err := rdb.Del(cleanup, cacheKeys...).Err(); err != nil {
			t.Errorf("fixture cache cleanup: %v", err)
		}
	})
	const secret = "translate-characterization-fixture"
	mux := authx.Middleware(secret, http.HandlerFunc(s.translate))
	requestAt := func(uid int64, body, remoteAddr string) *httptest.ResponseRecorder {
		t.Helper()
		token, err := authx.Sign(secret, uid, "fixture", "Fixture")
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/api/translate", strings.NewReader(body))
		req.RemoteAddr = remoteAddr
		req.Header.Set("Authorization", "Bearer "+token)
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		return res
	}
	request := func(uid int64, body string) *httptest.ResponseRecorder {
		return requestAt(uid, body, primaryIP+":12345")
	}
	check := func(res *httptest.ResponseRecorder, status int, cache string) {
		t.Helper()
		if res.Code != status {
			t.Fatalf("status=%d want=%d body=%s", res.Code, status, res.Body.String())
		}
		if status == http.StatusOK {
			var body map[string]string
			if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body["cache"] != cache || body["translatedText"] != "Xin chao" {
				t.Fatalf("unexpected response: %v", body)
			}
		}
	}
	message := fmt.Sprintf("{\"messageId\":%d,\"text\":\"ignored\",\"target\":\"vi\"}", mid)
	plain := fmt.Sprintf("{\"text\":%q,\"target\":\"vi\"}", source)
	check(request(users[1], message), 404, "")
	if calls.Load() != 0 {
		t.Fatal("non-member must not call provider")
	}
	check(request(users[0], message), 200, "miss")
	check(request(users[0], message), 200, "thread")
	check(request(users[0], plain), 200, "hit")

	failedSource := fmt.Sprintf("translate save failure fixture %d", stamp)
	var failedMessageID int64
	if err := db.QueryRow(ctx, "INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,$3) RETURNING id", cid, users[0], failedSource).Scan(&failedMessageID); err != nil {
		t.Fatal(err)
	}
	constraint := fmt.Sprintf("test_translate_save_failure_%d", stamp)
	statement := fmt.Sprintf("ALTER TABLE message_translations ADD CONSTRAINT %s CHECK (message_id <> %d OR provider <> 'fixture')", constraint, failedMessageID)
	if _, err := db.Exec(ctx, statement); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		if _, err := db.Exec(cleanup, "ALTER TABLE message_translations DROP CONSTRAINT IF EXISTS "+constraint); err != nil {
			t.Errorf("fixture constraint cleanup: %v", err)
		}
	})
	failedKey := s.cacheKey(failedSource, "vi")
	cacheKeys = append(cacheKeys, failedKey)
	var saveLog bytes.Buffer
	var failedSaveResponse *httptest.ResponseRecorder
	func() {
		previousLogOutput := log.Writer()
		log.SetOutput(&saveLog)
		defer log.SetOutput(previousLogOutput)
		failedBody := fmt.Sprintf("{\"messageId\":%d,\"target\":\"vi\"}", failedMessageID)
		failedSaveResponse = request(users[0], failedBody)
	}()
	check(failedSaveResponse, http.StatusOK, "miss")
	if !strings.Contains(saveLog.String(), "save message translation failed") {
		t.Fatalf("save failure was not logged: %q", saveLog.String())
	}
	var failedRows int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM message_translations WHERE message_id=$1 AND target_language='vi'", failedMessageID).Scan(&failedRows); err != nil {
		t.Fatal(err)
	}
	if failedRows != 0 {
		t.Fatalf("failed translation persisted: rows=%d", failedRows)
	}

	denied := false
	for i := 0; i <= 2*translationUserRateLimit; i++ {
		res := request(users[0], plain)
		if res.Code == http.StatusTooManyRequests {
			if res.Header().Get("Retry-After") != "60" {
				t.Fatalf("retry-after=%q", res.Header().Get("Retry-After"))
			}
			denied = true
			break
		}
		check(res, 200, "hit")
	}
	if !denied {
		t.Fatal("Redis cache hit must still consume quota")
	}
	check(request(users[0], message), 200, "thread")
	waitForStableRateLimitWindow(t)
	ipDenied := false
	ipAttempts := 0
	for _, uid := range users[1:] {
		for i := 0; i < 25; i++ {
			res := requestAt(uid, plain, quotaIP+":12345")
			ipAttempts++
			if res.Code == http.StatusTooManyRequests {
				if res.Header().Get("Retry-After") != "60" {
					t.Fatalf("IP retry-after=%q", res.Header().Get("Retry-After"))
				}
				ipDenied = true
				break
			}
			check(res, http.StatusOK, "hit")
		}
		if ipDenied {
			break
		}
	}
	if !ipDenied || ipAttempts != translationIPRateLimit+1 {
		t.Fatalf("IP quota denied=%v attempts=%d want=%d", ipDenied, ipAttempts, translationIPRateLimit+1)
	}
	check(request(users[1], message), 404, "")
	if calls.Load() != 2 {
		t.Fatalf("provider calls=%d, want two misses only", calls.Load())
	}
}

func waitForStableRateLimitWindow(t *testing.T) {
	t.Helper()
	windowSeconds := int64(translationRateLimitWindow.Seconds())
	now := time.Now()
	nextWindow := time.Unix(now.Unix()/windowSeconds*windowSeconds+windowSeconds, 0)
	if time.Until(nextWindow) < 10*time.Second {
		time.Sleep(time.Until(nextWindow) + time.Second)
	}
}
