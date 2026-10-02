package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/database"
	"chatnet/internal/httpx"
	"chatnet/internal/mailer"
	"chatnet/internal/ratelimit"
	"chatnet/internal/redisx"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

const (
	signupTTL         = 10 * time.Minute
	maxOTPAttempts    = 5
	maxPasswordLength = 72 // bcrypt accepts at most 72 bytes, not 72 Unicode characters.
)

var (
	emailRE = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	codeRE  = regexp.MustCompile(`^[0-9]{6}$`)
	tokenRE = regexp.MustCompile(`^[A-Za-z0-9_-]{24,128}$`)
)

type server struct {
	db         *pgxpool.Pool
	redis      *redis.Client
	limiter    ratelimit.Limiter
	jwtSecret  string
	otpPepper  string
	emailFrom  string
	resendKey  string
	resendBase string
}

type user struct {
	ID          int64     `json:"id"`
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	CreatedAt   time.Time `json:"createdAt"`
}

type pendingSignup struct {
	EmailOnly      bool   `json:"emailOnly,omitempty"`
	Email          string `json:"email"`
	Username       string `json:"username"`
	DisplayName    string `json:"displayName"`
	PasswordHash   string `json:"passwordHash"`
	CodeHash       string `json:"codeHash"`
	VerificationAt int64  `json:"verificationAt"`
}

func main() {
	ctx := context.Background()
	db, err := database.Open(ctx, config.Env("DATABASE_URL", "postgres://chatnet:chatnet@localhost:5432/chatnet?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := database.Migrate(ctx, db); err != nil {
		log.Fatal(err)
	}

	rdb, err := redisx.Open(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer rdb.Close()

	jwtSecret := config.Env("JWT_SECRET", "dev-secret-change-me")
	s := &server{
		db:         db,
		redis:      rdb,
		limiter:    ratelimit.Limiter{Redis: rdb},
		jwtSecret:  jwtSecret,
		otpPepper:  config.Env("OTP_PEPPER", jwtSecret),
		emailFrom:  config.Env("CHATNET_EMAIL_FROM", ""),
		resendKey:  config.Env("RESEND_API_KEY", ""),
		resendBase: config.Env("RESEND_API_BASE_URL", "https://api.resend.com"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /api/auth/register/start", s.registerStart)
	mux.HandleFunc("POST /api/auth/register/verify", s.registerVerify)
	mux.HandleFunc("POST /api/auth/register/resend", s.registerResend)
	mux.HandleFunc("POST /api/auth/email/start", s.registerStart)
	mux.HandleFunc("POST /api/auth/email/verify", s.registerVerify)
	mux.HandleFunc("POST /api/auth/email/resend", s.registerResend)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.Handle("GET /api/auth/me", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.me)))

	port := config.Env("PORT", "8081")
	log.Printf("auth service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	mailStatus := "ok"
	if s.resendKey == "" || s.emailFrom == "" {
		mailStatus = "missing_email_config"
	}
	httpx.JSON(w, http.StatusOK, map[string]string{
		"status": "ok", "service": "auth", "email": mailStatus,
	})
}

func (s *server) registerStart(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string `json:"email"`
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	username := strings.ToLower(strings.TrimSpace(body.Username))
	displayName := strings.TrimSpace(body.DisplayName)

	if !validEmail(email) {
		httpx.Error(w, http.StatusBadRequest, "enter a valid email address")
		return
	}
	emailOnly := r.URL.Path == "/api/auth/email/start" ||
		(body.Username == "" && body.DisplayName == "" && body.Password == "")
	if emailOnly {
		generated, err := newUsername()
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "unable to create username")
			return
		}
		username, displayName = generated, generated
	}
	if len(username) < 3 || len(username) > 64 || !validUsername(username) {
		httpx.Error(w, http.StatusBadRequest, "username must be 3-64 characters using letters, numbers, dot, underscore or hyphen")
		return
	}
	if displayName == "" || len(displayName) > 100 {
		httpx.Error(w, http.StatusBadRequest, "displayName is required and must be <= 100 characters")
		return
	}
	if !emailOnly && (len(body.Password) < 8 || len(body.Password) > maxPasswordLength) {
		httpx.Error(w, http.StatusBadRequest, "password must be 8-72 bytes in UTF-8")
		return
	}

	if !s.allow(w, r, "signup-email", email, 4, time.Hour) {
		return
	}
	if !s.allow(w, r, "signup-ip", clientIP(r), 20, time.Hour) {
		return
	}

	// Email-only requests reveal account existence only after mailbox verification.
	if !emailOnly {
		var exists bool
		if err := s.db.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM users WHERE email=$1 OR username=$2)`,
			email, username,
		).Scan(&exists); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "unable to check account")
			return
		}
		if exists {
			httpx.Error(w, http.StatusConflict, "email or username already registered")
			return
		}
	}

	// ponytail: OTP-only accounts cannot use password login; add password enrollment when needed.
	passwordHash := "!"
	if !emailOnly {
		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "unable to secure password")
			return
		}
		passwordHash = string(hash)
	}

	token, err := randomURL(32)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "unable to create verification request")
		return
	}
	code, err := newOTP()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "unable to create verification code")
		return
	}

	pending := pendingSignup{
		EmailOnly: emailOnly,
		Email:     email, Username: username, DisplayName: displayName,
		PasswordHash:   passwordHash,
		CodeHash:       s.otpHash(token, code),
		VerificationAt: time.Now().UnixMilli(),
	}
	if err := s.savePending(r.Context(), token, pending, signupTTL); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "unable to start email verification")
		return
	}

	if err := s.sendOTP(r.Context(), pending.Email, token, code); err != nil {
		_ = s.clearPending(r.Context(), token)
		log.Printf("signup email failed: %v", err)
		httpx.Error(w, http.StatusBadGateway, "we could not send the verification email")
		return
	}

	httpx.JSON(w, http.StatusAccepted, map[string]any{
		"verificationToken": token,
		"emailMasked":       maskEmail(email),
		"expiresInSeconds":  int(signupTTL.Seconds()),
	})
}

func (s *server) registerVerify(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
		Code  string `json:"code"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	token := strings.TrimSpace(body.Token)
	code := strings.TrimSpace(body.Code)
	if !tokenRE.MatchString(token) || !codeRE.MatchString(code) {
		httpx.Error(w, http.StatusBadRequest, "invalid verification token or code")
		return
	}

	if !s.allow(w, r, "signup-verify-token", token, 12, 10*time.Minute) {
		return
	}
	if !s.allow(w, r, "signup-verify-ip", clientIP(r), 60, 10*time.Minute) {
		return
	}

	pending, attemptsLeft, err := s.consumeOTP(r.Context(), token, code)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "verification unavailable")
		return
	}
	if attemptsLeft == -1 {
		httpx.Error(w, http.StatusGone, "verification request expired")
		return
	}

	if attemptsLeft >= 0 {
		if attemptsLeft == 0 {
			httpx.Error(w, http.StatusGone, "too many incorrect codes; request a new code")
			return
		}
		httpx.Error(w, http.StatusUnauthorized, fmt.Sprintf("verification code is incorrect (%d attempts left)", attemptsLeft))
		return
	}

	var u user
	query := `
		INSERT INTO users(email,username,password_hash,display_name,email_verified_at)
		VALUES($1,$2,$3,$4,NOW())`
	if pending.EmailOnly {
		query += ` ON CONFLICT (email) DO UPDATE SET email_verified_at=NOW()`
	}
	query += ` RETURNING id,email,username,display_name,created_at`
	err = s.db.QueryRow(r.Context(), query,
		pending.Email, pending.Username, pending.PasswordHash, pending.DisplayName,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.Error(w, http.StatusConflict, "email or username already registered; request a new code")
		} else {
			httpx.Error(w, http.StatusInternalServerError, "unable to complete verification; request a new code")
		}
		return
	}

	jwtToken, err := authx.Sign(s.jwtSecret, u.ID, u.Username, u.DisplayName)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create token")
		return
	}

	status := http.StatusCreated
	if pending.EmailOnly {
		status = http.StatusOK
	}
	httpx.JSON(w, status, map[string]any{
		"token": jwtToken,
		"user":  u,
	})
}

func (s *server) registerResend(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	token := strings.TrimSpace(body.Token)
	if !tokenRE.MatchString(token) {
		httpx.Error(w, http.StatusBadRequest, "invalid verification token")
		return
	}
	if !s.allow(w, r, "signup-resend-token", token, 3, 10*time.Minute) {
		return
	}
	if !s.allow(w, r, "signup-resend-ip", clientIP(r), 10, 10*time.Minute) {
		return
	}

	pending, _, ok, err := s.loadPending(r.Context(), token)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "verification unavailable")
		return
	}
	if !ok {
		httpx.Error(w, http.StatusGone, "verification request expired")
		return
	}

	code, err := newOTP()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "unable to create verification code")
		return
	}
	oldHash := pending.CodeHash
	pending.CodeHash = s.otpHash(token, code)
	pending.VerificationAt = time.Now().UnixMilli()
	ok, err = s.replacePending(r.Context(), token, oldHash, pending)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "verification unavailable")
		return
	}
	if !ok {
		httpx.Error(w, http.StatusGone, "verification request expired or changed")
		return
	}

	if err := s.sendOTP(r.Context(), pending.Email, token, code); err != nil {
		log.Printf("resend signup email failed: %v", err)
		httpx.Error(w, http.StatusBadGateway, "we could not resend the verification email")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"verificationToken": token,
		"emailMasked":       maskEmail(pending.Email),
		"expiresInSeconds":  int(signupTTL.Seconds()),
	})
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	if !validEmail(email) || len(body.Password) > maxPasswordLength {
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if !s.allow(w, r, "login-email", email, 12, 10*time.Minute) {
		return
	}
	if !s.allow(w, r, "login-ip", clientIP(r), 40, 10*time.Minute) {
		return
	}

	var u user
	var hash string
	err := s.db.QueryRow(r.Context(), `
		SELECT id,email,username,display_name,password_hash,created_at
		FROM users WHERE email=$1`, email,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &hash, &u.CreatedAt)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := authx.Sign(s.jwtSecret, u.ID, u.Username, u.DisplayName)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create token")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}

func (s *server) me(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var u user
	if err := s.db.QueryRow(r.Context(), `
		SELECT id,email,username,display_name,created_at FROM users WHERE id=$1`,
		claims.UserID,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.CreatedAt); err != nil {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (s *server) allow(w http.ResponseWriter, r *http.Request, scope, subject string, limit int64, window time.Duration) bool {
	ok, _, err := s.limiter.Allow(r.Context(), scope, subject, limit, window)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "rate limiter unavailable")
		return false
	}
	if !ok {
		httpx.Error(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return false
	}
	return true
}

func (s *server) savePending(ctx context.Context, token string, pending pendingSignup, ttl time.Duration) error {
	raw, err := json.Marshal(pending)
	if err != nil {
		return err
	}
	return s.redis.Set(ctx, signupPendingKey(token), raw, ttl).Err()
}

// Comparison, attempt accounting and consumption are atomic, including concurrent resend/verify.
var consumeOTPScript = redis.NewScript(`
local raw = redis.call('GET', KEYS[1])
if not raw then return '-1' end
local pending = cjson.decode(raw)
if pending.codeHash ~= ARGV[1] then
	local attempts = redis.call('INCR', KEYS[2])
	redis.call('PEXPIRE', KEYS[2], redis.call('PTTL', KEYS[1]))
	local remaining = tonumber(ARGV[2]) - attempts
	if remaining <= 0 then
		redis.call('DEL', KEYS[1], KEYS[2])
		return '0'
	end
	return tostring(remaining)
end
redis.call('DEL', KEYS[1], KEYS[2])
return raw
`)

func (s *server) consumeOTP(ctx context.Context, token, code string) (pendingSignup, int, error) {
	result, err := consumeOTPScript.Run(ctx, s.redis,
		[]string{signupPendingKey(token), signupAttemptsKey(token)},
		s.otpHash(token, code), maxOTPAttempts).Text()
	if err != nil {
		return pendingSignup{}, -1, err
	}
	if result == "-1" {
		return pendingSignup{}, -1, nil
	}
	if len(result) == 1 && result[0] >= '0' && result[0] <= '4' {
		return pendingSignup{}, int(result[0] - '0'), nil
	}
	var pending pendingSignup
	err = json.Unmarshal([]byte(result), &pending)
	return pending, -2, err
}

var replacePendingScript = redis.NewScript(`
local raw = redis.call('GET', KEYS[1])
if not raw or cjson.decode(raw).codeHash ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
if redis.call('EXISTS', KEYS[2]) == 1 then
	redis.call('PEXPIRE', KEYS[2], ARGV[3])
end
return 1
`)

func (s *server) replacePending(ctx context.Context, token, oldHash string, pending pendingSignup) (bool, error) {
	raw, err := json.Marshal(pending)
	if err != nil {
		return false, err
	}
	result, err := replacePendingScript.Run(ctx, s.redis,
		[]string{signupPendingKey(token), signupAttemptsKey(token)},
		oldHash, raw, signupTTL.Milliseconds()).Int()
	return result == 1, err
}

func (s *server) loadPending(ctx context.Context, token string) (pendingSignup, time.Duration, bool, error) {
	if !tokenRE.MatchString(token) {
		return pendingSignup{}, 0, false, nil
	}
	raw, err := s.redis.Get(ctx, signupPendingKey(token)).Bytes()
	if errors.Is(err, redis.Nil) {
		return pendingSignup{}, 0, false, nil
	}
	if err != nil {
		return pendingSignup{}, 0, false, err
	}

	var pending pendingSignup
	if err := json.Unmarshal(raw, &pending); err != nil {
		_ = s.clearPending(ctx, token)
		return pendingSignup{}, 0, false, nil
	}
	ttl, err := s.redis.TTL(ctx, signupPendingKey(token)).Result()
	if err != nil || ttl <= 0 {
		_ = s.clearPending(ctx, token)
		return pendingSignup{}, 0, false, err
	}
	return pending, ttl, true, nil
}

func (s *server) clearPending(ctx context.Context, token string) error {
	return s.redis.Del(ctx, signupPendingKey(token), signupAttemptsKey(token)).Err()
}

func (s *server) sendOTP(ctx context.Context, email, token, code string) error {
	client, err := mailer.New(s.resendKey, s.emailFrom, s.resendBase)
	if err != nil {
		return err
	}

	subject := "Mã xác minh ChatNet của bạn"
	text := "Mã xác minh ChatNet của bạn là " + code + ". Mã hết hạn sau 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua email."
	html := `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:520px;margin:auto;padding:32px;color:#172238">` +
		`<div style="font-size:13px;font-weight:800;color:#4b7600">CHATNET</div>` +
		`<h2 style="margin:12px 0">Xác minh email của bạn</h2>` +
		`<p style="color:#667085">Nhập mã 6 chữ số bên dưới để vào tài khoản ChatNet.</p>` +
		`<div style="font-size:36px;font-weight:800;letter-spacing:9px;margin:28px 0;color:#4b7600">` + code + `</div>` +
		`<p style="color:#8a94a6;font-size:14px">Mã hết hạn sau 10 phút. Nếu bạn không yêu cầu mã này, bạn có thể bỏ qua email.</p></div>`

	idempotency := "chatnet-signup-otp-" + token + "-" + s.otpHash(token, code)[:16]
	return client.Send(ctx, mailer.Message{
		To: email, Subject: subject, HTML: html, Text: text,
	}, idempotency)
}

func (s *server) otpHash(token, code string) string {
	sum := sha256.Sum256([]byte(s.otpPepper + "\x00chatnet-signup-email-otp-v1\x00" + token + "\x00" + code))
	return hex.EncodeToString(sum[:])
}

func newOTP() (string, error) {
	value, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", value.Int64()), nil
}

func newUsername() (string, error) {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	return "user_" + hex.EncodeToString(buf[:]), nil
}

func randomURL(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func signupPendingKey(token string) string {
	return "chatnet:signup-verification:" + token
}

func signupAttemptsKey(token string) string {
	return "chatnet:signup-verification-attempts:" + token
}

func validEmail(value string) bool {
	return len(value) <= 254 && emailRE.MatchString(value)
}

func validUsername(value string) bool {
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '.', r == '_', r == '-':
		default:
			return false
		}
	}
	return true
}

func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 || parts[0] == "" {
		return email
	}
	local := parts[0]
	if len(local) == 1 {
		local = local[:1] + "***"
	} else {
		maskLen := len(local) - 1
		if maskLen > 6 {
			maskLen = 6
		}
		local = local[:1] + strings.Repeat("*", maskLen)
	}
	return local + "@" + parts[1]
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		if first, _, ok := strings.Cut(forwarded, ","); ok {
			return strings.TrimSpace(first)
		}
		return forwarded
	}
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}
