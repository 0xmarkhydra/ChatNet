package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRefreshRejectsInvalidCredentials(t *testing.T) {
	s := &server{jwtSecret: "test"}
	for _, body := range []string{`{`, `{"refreshToken":"short"}`, `{"refreshToken":123}`, `{"unknown":"value"}`, `{} {}`, `{"refreshToken":"` + strings.Repeat("x", 2000) + `"}`} {
		w := httptest.NewRecorder()
		s.refresh(w, httptest.NewRequest("POST", "/api/auth/refresh", strings.NewReader(body)))
		if w.Code != http.StatusBadRequest {
			t.Fatalf("got %d for %s", w.Code, body)
		}
	}
	expired, err := jwt.NewWithClaims(jwt.SigningMethodHS256, authx.Claims{
		UserID: 1,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
		},
	}).SignedString([]byte(s.jwtSecret))
	if err != nil {
		t.Fatal(err)
	}
	for _, access := range []string{"", "invalid", expired} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "/api/auth/refresh", strings.NewReader(`{}`))
		r.Header.Set("Authorization", "Bearer "+access)
		s.refresh(w, r)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("invalid access upgraded: %d", w.Code)
		}
	}
}

func TestBrowserSessionUsesSecureCookieWithoutJSONRefreshToken(t *testing.T) {
	t.Setenv("CHATNET_WEB_URL", "https://chat.example")
	t.Setenv("CHATNET_CORS_ORIGINS", "https://chat.example")
	r := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	r.Header.Set("Origin", "https://chat.example")
	w := httptest.NewRecorder()
	u := user{ID: 7, Username: "tester"}
	writeSessionResponse(w, r, http.StatusOK, "access-token", strings.Repeat("r", 43), u)

	cookie := w.Result().Cookies()[0]
	if cookie.Name != refreshCookieName || cookie.Value != strings.Repeat("r", 43) ||
		cookie.Path != "/api/auth" || !cookie.HttpOnly || !cookie.Secure ||
		cookie.SameSite != http.SameSiteStrictMode || cookie.Domain != "" || cookie.MaxAge != int(sessionTTL.Seconds()) {
		t.Fatalf("unexpected refresh cookie: %+v", cookie)
	}
	if strings.Contains(w.Body.String(), "refreshToken") || !strings.Contains(w.Body.String(), "access-token") {
		t.Fatalf("browser response must omit refresh token: %s", w.Body.String())
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("session response cache policy = %q", w.Header().Get("Cache-Control"))
	}
}

func TestClearRefreshCookieKeepsCookieScopeAndSecurity(t *testing.T) {
	w := httptest.NewRecorder()
	clearRefreshCookie(w)
	cookies := w.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("clear response cookies = %d, want 1", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != refreshCookieName || cookie.Path != "/api/auth" || cookie.MaxAge >= 0 ||
		!cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteStrictMode || cookie.Domain != "" {
		t.Fatalf("unexpected clear cookie: %+v", cookie)
	}
}

func TestNativeSessionResponseKeepsRefreshTokenJSON(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	writeSessionResponse(w, r, http.StatusOK, "access-token", strings.Repeat("r", 43), user{ID: 7})
	if !strings.Contains(w.Body.String(), "refreshToken") || len(w.Result().Cookies()) != 0 {
		t.Fatalf("native response must retain JSON credential without cookie: %s", w.Body.String())
	}
}

func TestRefreshCookieRequiresConfiguredWebOrigin(t *testing.T) {
	t.Setenv("CHATNET_WEB_URL", "https://chat.example")
	t.Setenv("CHATNET_CORS_ORIGINS", "https://chat.example")
	for _, tc := range []struct {
		origin string
		want   int
		ok     bool
	}{{origin: "https://chat.example", want: http.StatusOK, ok: true}, {origin: "https://evil.example", want: http.StatusForbidden}} {
		t.Run(tc.origin, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{}`))
			r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: strings.Repeat("r", 43)})
			r.Header.Set("Origin", tc.origin)
			w := httptest.NewRecorder()
			_, ok := readRefreshToken(w, r)
			if ok != tc.ok || (!tc.ok && w.Code != tc.want) {
				t.Fatalf("readRefreshToken status=%d ok=%v, want %d/%v", w.Code, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestSessionIntegration(t *testing.T) {
	t.Setenv("CHATNET_WEB_URL", "https://chat.example")
	t.Setenv("CHATNET_CORS_ORIGINS", "https://chat.example")
	if os.Getenv("CHATNET_TEST_DATABASE_URL") == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for disposable database")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, os.Getenv("CHATNET_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	name, err := newUsername()
	if err != nil {
		t.Fatal(err)
	}
	var u user
	err = db.QueryRow(ctx, `INSERT INTO users(email,username,display_name,password_hash)
		VALUES($1,$2,'Session test','!') RETURNING id,email,username,display_name,created_at`,
		name+"@example.com", name).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.CreatedAt)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", u.ID)
	s := &server{db: db, jwtSecret: "session-test"}
	w := httptest.NewRecorder()
	s.startSession(w, httptest.NewRequest("POST", "/", nil), u, http.StatusOK)
	var initial struct{ Token, RefreshToken string }
	if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &initial) != nil || len(initial.RefreshToken) != 43 {
		t.Fatalf("session issue failed: %d %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("credentials must not be cached")
	}
	initialClaims, err := authx.Parse(s.jwtSecret, initial.Token)
	if err != nil || initialClaims.SessionID == "" {
		t.Fatal("access token must be bound to its session")
	}
	active, err := authx.SessionActive(ctx, db, initialClaims)
	if err != nil || !active {
		t.Fatal("newly created access token should be authorized")
	}
	var hash string
	var expires time.Time
	if err := db.QueryRow(ctx, "SELECT token_hash,expires_at FROM auth_sessions WHERE user_id=$1", u.ID).Scan(&hash, &expires); err != nil {
		t.Fatal(err)
	}
	if hash != sessionHash(initial.RefreshToken) || time.Until(expires) > sessionTTL || time.Until(expires) < sessionTTL-time.Minute {
		t.Fatal("session hash or bounded expiry incorrect")
	}
	call := func(handler http.HandlerFunc, refresh, access string, status int) *httptest.ResponseRecorder {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"refreshToken": refresh})
		r := httptest.NewRequest("POST", "/", strings.NewReader(string(body)))
		r.Header.Set("Authorization", "Bearer "+access)
		w := httptest.NewRecorder()
		handler(w, r)
		if w.Code != status {
			t.Fatalf("got %d want %d: %s", w.Code, status, w.Body.String())
		}
		return w
	}
	// A restart needs only PostgreSQL and the same signing secret, not Redis.
	s = &server{db: db, jwtSecret: s.jwtSecret}
	browserSessionResponse := httptest.NewRecorder()
	browserSessionRequest := httptest.NewRequest("POST", "/", nil)
	browserSessionRequest.Header.Set("Origin", "https://chat.example")
	s.startSession(browserSessionResponse, browserSessionRequest, u, http.StatusOK)
	browserCookies := browserSessionResponse.Result().Cookies()
	if browserSessionResponse.Code != http.StatusOK || len(browserCookies) != 1 || browserCookies[0].Name != refreshCookieName {
		t.Fatalf("browser session issue failed: %d cookies=%+v", browserSessionResponse.Code, browserCookies)
	}
	browserLogoutRequest := httptest.NewRequest("POST", "/", strings.NewReader(`{}`))
	browserLogoutRequest.Header.Set("Origin", "https://chat.example")
	browserLogoutRequest.AddCookie(browserCookies[0])
	browserLogoutResponse := httptest.NewRecorder()
	s.logout(browserLogoutResponse, browserLogoutRequest)
	clearedCookies := browserLogoutResponse.Result().Cookies()
	if browserLogoutResponse.Code != http.StatusNoContent || len(clearedCookies) != 1 ||
		clearedCookies[0].Name != refreshCookieName || clearedCookies[0].Path != "/api/auth" ||
		clearedCookies[0].MaxAge >= 0 || !clearedCookies[0].HttpOnly || !clearedCookies[0].Secure ||
		clearedCookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatalf("browser logout did not expire secure refresh cookie: status=%d cookies=%+v",
			browserLogoutResponse.Code, clearedCookies)
	}
	if _, err := db.Exec(ctx, "UPDATE users SET display_name='Updated' WHERE id=$1", u.ID); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 3; i++ {
		result := call(s.refresh, initial.RefreshToken, "expired-access-is-not-needed", http.StatusOK)
		var renewed struct{ Token, RefreshToken string }
		if err := json.Unmarshal(result.Body.Bytes(), &renewed); err != nil {
			t.Fatal(err)
		}
		claims, err := authx.Parse(s.jwtSecret, renewed.Token)
		if err != nil || claims.UserID != u.ID || claims.DisplayName != "Updated" || renewed.RefreshToken != initial.RefreshToken {
			t.Fatal("refresh did not retain user identity and current profile")
		}
	}
	call(s.refresh, strings.Repeat("x", 43), initial.Token, http.StatusUnauthorized)
	call(s.logout, initial.RefreshToken, "", http.StatusNoContent)
	active, err = authx.SessionActive(ctx, db, initialClaims)
	if err != nil || active {
		t.Fatal("revoked session still authorizes its access token")
	}
	call(s.logout, initial.RefreshToken, "", http.StatusNoContent)
	call(s.refresh, initial.RefreshToken, initial.Token, http.StatusUnauthorized)

	// Revoked access credentials must never mint a new refresh token.
	call(s.refresh, "", initial.Token, http.StatusUnauthorized)
	if _, err := db.Exec(ctx, "UPDATE auth_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1", u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "DELETE FROM users WHERE id=$1", u.ID); err != nil {
		t.Fatal(err)
	}
	call(s.refresh, "", initial.Token, http.StatusUnauthorized)
	db.Close()
	call(s.refresh, initial.RefreshToken, "", http.StatusServiceUnavailable)
	call(s.logout, initial.RefreshToken, "", http.StatusServiceUnavailable)
}
