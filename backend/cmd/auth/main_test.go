package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

func TestGeneratedUsername(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		name, err := newUsername()
		if err != nil || !regexp.MustCompile(`^user_[0-9a-f]{16}$`).MatchString(name) || !validUsername(name) || seen[name] {
			t.Fatalf("invalid or repeated generated username: %q, %v", name, err)
		}
		seen[name] = true
	}
}

func TestEmailOnlyRejectsInvalidEmail(t *testing.T) {
	for _, email := range []string{"", "invalid", "x@y", strings.Repeat("a", 250) + "@test.com"} {
		request := httptest.NewRequest(http.MethodPost, "/api/auth/email/start", strings.NewReader(fmt.Sprintf(`{"email":%q}`, email)))
		response := httptest.NewRecorder()
		(&server{}).registerStart(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("invalid email accepted: %d", response.Code)
		}
	}
}

// Run against disposable services with CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR.
func TestEmailAuthIntegration(t *testing.T) {
	dbURL, redisAddr := os.Getenv("CHATNET_TEST_DATABASE_URL"), os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if dbURL == "" || redisAddr == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR for integration tests")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	t.Cleanup(func() { _ = rdb.Close() })
	codes := make(chan string, 10)
	mail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct{ Text string }
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		codes <- regexp.MustCompile(`[0-9]{6}`).FindString(body.Text)
		w.WriteHeader(http.StatusOK)
	}))
	defer mail.Close()
	s := &server{db: db, redis: rdb, jwtSecret: "test-secret", otpPepper: "test-pepper",
		resendBase: mail.URL, resendKey: "test", emailFrom: "test@example.com"}
	call := func(handler http.HandlerFunc, path, body string, status int) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		handler(w, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
		if w.Code != status {
			t.Fatalf("%s: got %d, want %d: %s", path, w.Code, status, w.Body.String())
		}
		return w
	}
	suffix, err := newUsername()
	if err != nil {
		t.Fatal(err)
	}
	email := suffix + "@example.com"
	defer db.Exec(ctx, "DELETE FROM users WHERE email=$1", email)
	start := func() (string, string) {
		t.Helper()
		w := call(s.registerStart, "/api/auth/email/start", fmt.Sprintf(`{"email":%q}`, strings.ToUpper(email)), http.StatusAccepted)
		var result struct{ VerificationToken string }
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = s.clearPending(ctx, result.VerificationToken) })
		return result.VerificationToken, <-codes
	}
	verify := func(token, code string, status int) *httptest.ResponseRecorder {
		t.Helper()
		return call(s.registerVerify, "/api/auth/email/verify", fmt.Sprintf(`{"token":%q,"code":%q}`, token, code), status)
	}
	token, code := start()
	var count int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM users WHERE email=$1", email).Scan(&count); err != nil || count != 0 {
		t.Fatalf("account created before verification: %d, %v", count, err)
	}
	result := verify(token, code, http.StatusOK)
	var session struct {
		Token string
		User  user
	}
	if err := json.Unmarshal(result.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	if session.User.Email != email || session.User.Username != session.User.DisplayName || !strings.HasPrefix(session.User.Username, "user_") {
		t.Fatalf("incorrect defaults: %+v", session.User)
	}
	if _, err := authx.Parse(s.jwtSecret, session.Token); err != nil {
		t.Fatal(err)
	}
	verify(token, code, http.StatusGone)
	call(s.login, "/api/auth/login", fmt.Sprintf(`{"email":%q,"password":"!"}`, email), http.StatusUnauthorized)

	// Existing password accounts keep both identity and password when using OTP.
	hash, err := bcrypt.GenerateFromPassword([]byte("old-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "UPDATE users SET password_hash=$1,display_name='Old Name' WHERE email=$2", string(hash), email); err != nil {
		t.Fatal(err)
	}
	token, code = start()
	result = verify(token, code, http.StatusOK)
	var returning struct{ User user }
	if err := json.Unmarshal(result.Body.Bytes(), &returning); err != nil {
		t.Fatal(err)
	}
	if returning.User.ID != session.User.ID || returning.User.Username != session.User.Username || returning.User.DisplayName != "Old Name" {
		t.Fatal("OTP login changed existing identity")
	}
	call(s.login, "/api/auth/login", fmt.Sprintf(`{"email":%q,"password":"old-password"}`, email), http.StatusOK)

	token, code = start()
	wrong := "000000"
	if code == wrong {
		wrong = "111111"
	}
	verify(token, wrong, http.StatusUnauthorized)
	call(s.registerResend, "/api/auth/email/resend", fmt.Sprintf(`{"token":%q}`, token), http.StatusOK)
	newCode := <-codes
	// Resend must preserve the failed-attempt budget.
	if attempts := rdb.Get(ctx, signupAttemptsKey(token)).Val(); attempts != "1" {
		t.Fatalf("resend reset attempts: %q", attempts)
	}
	wrong = "000000"
	if newCode == wrong {
		wrong = "111111"
	}
	for i := 0; i < 3; i++ {
		verify(token, wrong, http.StatusUnauthorized)
	}
	verify(token, wrong, http.StatusGone)
	verify(token, newCode, http.StatusGone)

	token, code = start()
	if err := rdb.PExpire(ctx, signupPendingKey(token), time.Millisecond).Err(); err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	verify(token, code, http.StatusGone)

	token, err = randomURL(32)
	if err != nil {
		t.Fatal(err)
	}
	code = "234567"
	if err := s.savePending(ctx, token, pendingSignup{CodeHash: s.otpHash(token, code)}, signupTTL); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.clearPending(ctx, token) })
	pending, _, ok, err := s.loadPending(ctx, token)
	if err != nil || !ok {
		t.Fatalf("pending missing: %v", err)
	}
	oldHash := pending.CodeHash
	nextCode := "123456"
	if nextCode == code {
		nextCode = "654321"
	}
	pending.CodeHash = s.otpHash(token, nextCode)
	if ok, err := s.replacePending(ctx, token, oldHash, pending); err != nil || !ok {
		t.Fatalf("replace failed: %v", err)
	}
	verify(token, code, http.StatusUnauthorized)
	var successes atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, state, err := s.consumeOTP(ctx, token, nextCode)
			if err != nil {
				t.Error(err)
			}
			if state == -2 {
				successes.Add(1)
			}
		}()
	}
	wg.Wait()
	if successes.Load() != 1 {
		t.Fatalf("OTP consumed %d times", successes.Load())
	}
	if ok, err := s.replacePending(ctx, token, pending.CodeHash, pending); err != nil || ok {
		t.Fatalf("resend resurrected consumed OTP: %v", err)
	}
}

func TestRegisterRejectsPasswordBeyondBcryptLimit(t *testing.T) {
	for _, password := range []string{strings.Repeat("a", 73), strings.Repeat("é", 37)} {
		body := `{"email":"test@example.com","username":"tester","displayName":"Test","password":"` + password + `"}`
		request := httptest.NewRequest(http.MethodPost, "/api/auth/register/start", strings.NewReader(body))
		response := httptest.NewRecorder()
		// Invalid passwords must fail before accessing Redis, the DB, or the mail provider.
		(&server{}).registerStart(response, request)
		if response.Code != http.StatusBadRequest || !strings.Contains(response.Body.String(), "8-72 bytes") {
			t.Fatalf("unexpected response: %d %s", response.Code, response.Body.String())
		}
	}
}

func TestNewOTPIsSixDigits(t *testing.T) {
	pattern := regexp.MustCompile(`^[0-9]{6}$`)
	for i := 0; i < 20; i++ {
		code, err := newOTP()
		if err != nil {
			t.Fatal(err)
		}
		if !pattern.MatchString(code) {
			t.Fatalf("unexpected OTP: %q", code)
		}
	}
}

func TestOTPHashBindsTokenAndCode(t *testing.T) {
	s := &server{otpPepper: "test-pepper"}
	first := s.otpHash("token-one", "123456")
	if first == s.otpHash("token-one", "654321") {
		t.Fatal("OTP hash must change with code")
	}
	if first == s.otpHash("token-two", "123456") {
		t.Fatal("OTP hash must change with verification token")
	}
}

func TestMaskEmail(t *testing.T) {
	if got := maskEmail("someone@example.com"); got != "s******@example.com" {
		t.Fatalf("maskEmail()=%q", got)
	}
}

func TestValidUsername(t *testing.T) {
	for _, value := range []string{"mongdev", "mong.dev", "mong_dev", "mong-dev", "abc123"} {
		if !validUsername(value) {
			t.Fatalf("expected valid username %q", value)
		}
	}
	for _, value := range []string{"mong dev", "mong@", "MONG"} {
		if validUsername(value) {
			t.Fatalf("expected invalid username %q", value)
		}
	}
}
