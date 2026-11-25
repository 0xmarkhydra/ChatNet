package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

const sessionTTL = 90 * 24 * time.Hour
const refreshCookieName = "chatnet_refresh"

func browserSessionRequest(r *http.Request) bool {
	return httpx.IsWebOrigin(r.Header.Get("Origin"))
}

func setRefreshCookie(w http.ResponseWriter, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    value,
		Path:     "/api/auth",
		Expires:  time.Now().Add(sessionTTL),
		MaxAge:   int(sessionTTL.Seconds()),
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

func clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/api/auth",
		MaxAge:   -1,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

func writeSessionResponse(w http.ResponseWriter, r *http.Request, status int, access, refresh string, u user) {
	w.Header().Set("Cache-Control", "no-store")
	if browserSessionRequest(r) {
		setRefreshCookie(w, refresh)
		httpx.JSON(w, status, map[string]any{"token": access, "user": u})
		return
	}
	httpx.JSON(w, status, map[string]any{"token": access, "refreshToken": refresh, "user": u})
}

func hasRefreshCookie(r *http.Request) bool {
	_, err := r.Cookie(refreshCookieName)
	return err == nil
}

func sessionHash(token string) string {
	hash := sha256.Sum256([]byte("chatnet-session-v1\x00" + token))
	return hex.EncodeToString(hash[:])
}

func readRefreshToken(w http.ResponseWriter, r *http.Request) (string, bool) {
	w.Header().Set("Cache-Control", "no-store")
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF ||
		(body.RefreshToken != "" && (len(body.RefreshToken) != 43 || !tokenRE.MatchString(body.RefreshToken))) {
		httpx.Error(w, http.StatusBadRequest, "invalid refresh token")
		return "", false
	}
	if cookie, err := r.Cookie(refreshCookieName); err == nil {
		if !httpx.IsWebOrigin(r.Header.Get("Origin")) {
			httpx.Error(w, http.StatusForbidden, "invalid session origin")
			return "", false
		}
		if len(cookie.Value) != 43 || !tokenRE.MatchString(cookie.Value) {
			httpx.Error(w, http.StatusUnauthorized, "invalid refresh cookie")
			return "", false
		}
		return cookie.Value, true
	}
	return body.RefreshToken, true
}

func (s *server) startSession(w http.ResponseWriter, r *http.Request, u user, status int) {
	w.Header().Set("Cache-Control", "no-store")
	refresh, err := randomURL(32)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create session")
		return
	}
	// Delete expired credentials without extending the lifetime of active ones.
	var sessionID string
	err = s.db.QueryRow(r.Context(), `
		WITH expired AS (DELETE FROM auth_sessions WHERE expires_at <= NOW())
		INSERT INTO auth_sessions(token_hash,user_id,expires_at,user_agent)
		VALUES($1,$2,$3,LEFT($4,180))
		RETURNING session_id::text`,
		sessionHash(refresh), u.ID, time.Now().Add(sessionTTL), r.UserAgent()).Scan(&sessionID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot save session")
		return
	}
	access, err := authx.Sign(s.jwtSecret, u.ID, u.Username, u.DisplayName, sessionID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create token")
		return
	}
	writeSessionResponse(w, r, status, access, refresh, u)
}

func (s *server) refresh(w http.ResponseWriter, r *http.Request) {
	refresh, ok := readRefreshToken(w, r)
	if !ok {
		return
	}
	var u user
	var sessionID string
	if refresh == "" {
		// Do not mint new refresh credentials from a long-lived access token:
		// otherwise logging out would be reversible while that JWT is valid.
		httpx.Error(w, http.StatusUnauthorized, "session expired; please sign in again")
		return
	}
	// Fixed-expiry refresh tokens support concurrent tabs/retries. Each valid
	// refresh updates the last-seen timestamp without prolonging its 90-day TTL.
	err := s.db.QueryRow(r.Context(), `
		WITH current_session AS (
			UPDATE auth_sessions
			SET last_seen_at=NOW()
			WHERE token_hash=$1 AND expires_at>NOW()
			RETURNING user_id,session_id
		)
		SELECT u.id,u.email,u.username,u.display_name,u.created_at,s.session_id::text
		FROM current_session s JOIN users u ON u.id=s.user_id
	`, sessionHash(refresh)).
		Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.CreatedAt, &sessionID)
	if err != nil {
		sessionError(w, err)
		return
	}
	access, err := authx.Sign(s.jwtSecret, u.ID, u.Username, u.DisplayName, sessionID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create token")
		return
	}
	writeSessionResponse(w, r, http.StatusOK, access, refresh, u)
}

func sessionError(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusUnauthorized, "session expired")
	} else {
		httpx.Error(w, http.StatusServiceUnavailable, "session unavailable")
	}
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	refresh, ok := readRefreshToken(w, r)
	if !ok {
		return
	}
	if refresh != "" {
		var userID int64
		var sessionID string
		err := s.db.QueryRow(r.Context(), "DELETE FROM auth_sessions WHERE token_hash=$1 RETURNING user_id,session_id::text", sessionHash(refresh)).Scan(&userID, &sessionID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke session")
			return
		}
		if err == nil {
			s.notifySessionRevoked(r.Context(), userID, sessionID)
		}
	}
	if hasRefreshCookie(r) {
		clearRefreshCookie(w)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) notifySessionRevoked(ctx context.Context, userID int64, sessionIDs ...string) {
	if s.redis == nil || userID <= 0 {
		return
	}
	// PostgreSQL is authoritative. Invalidate positive caches before notifying clients.
	// If Redis disconnects during a revocation, HTTP guards use PostgreSQL and
	// any remaining positive cache entry expires within ten seconds.
	if err := authx.InvalidateSessions(ctx, s.redis, userID, sessionIDs...); err != nil {
		log.Printf("session revocation cache invalidation failed: %v", err)
	}
	if err := s.redis.Publish(ctx, authx.UserChannel(userID), authx.SessionRevocationSignal).Err(); err != nil {
		log.Printf("session revocation notification failed: %v", err)
	}
}
