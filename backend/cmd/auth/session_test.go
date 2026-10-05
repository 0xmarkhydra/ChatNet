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
	for _, body := range []string{`{`, `{"refreshToken":"short"}`, `{"refreshToken":123}`} {
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

func TestSessionIntegration(t *testing.T) {
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
	call(s.logout, initial.RefreshToken, "", http.StatusNoContent)
	call(s.refresh, initial.RefreshToken, initial.Token, http.StatusUnauthorized)

	// Existing unexpired clients can adopt refresh without entering OTP again.
	result := call(s.refresh, "", initial.Token, http.StatusOK)
	var migrated struct{ RefreshToken string }
	if err := json.Unmarshal(result.Body.Bytes(), &migrated); err != nil || migrated.RefreshToken == "" {
		t.Fatal("legacy session not migrated")
	}
	if _, err := db.Exec(ctx, "UPDATE auth_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1", u.ID); err != nil {
		t.Fatal(err)
	}
	call(s.refresh, migrated.RefreshToken, "", http.StatusUnauthorized)
	if _, err := db.Exec(ctx, "DELETE FROM users WHERE id=$1", u.ID); err != nil {
		t.Fatal(err)
	}
	call(s.refresh, "", initial.Token, http.StatusUnauthorized)
	db.Close()
	call(s.refresh, initial.RefreshToken, "", http.StatusServiceUnavailable)
	call(s.logout, initial.RefreshToken, "", http.StatusServiceUnavailable)
}
