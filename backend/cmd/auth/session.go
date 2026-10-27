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

func sessionHash(token string) string {
	hash := sha256.Sum256([]byte("chatnet-session-v1\x00" + token))
	return hex.EncodeToString(hash[:])
}

func readRefreshToken(w http.ResponseWriter, r *http.Request) (string, bool) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	w.Header().Set("Cache-Control", "no-store")
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF ||
		(body.RefreshToken != "" && (len(body.RefreshToken) != 43 || !tokenRE.MatchString(body.RefreshToken))) {
		httpx.Error(w, http.StatusBadRequest, "invalid refresh token")
		return "", false
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
	httpx.JSON(w, status, map[string]any{"token": access, "refreshToken": refresh, "user": u})
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
	httpx.JSON(w, http.StatusOK, map[string]any{"token": access, "refreshToken": refresh, "user": u})
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
		err := s.db.QueryRow(r.Context(), "DELETE FROM auth_sessions WHERE token_hash=$1 RETURNING user_id", sessionHash(refresh)).Scan(&userID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke session")
			return
		}
		if err == nil {
			s.notifySessionRevoked(r.Context(), userID)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) notifySessionRevoked(ctx context.Context, userID int64) {
	if s.redis == nil || userID <= 0 {
		return
	}
	// PostgreSQL is authoritative; clients also detect missed Redis events via SSE checks.
	if err := s.redis.Publish(ctx, authx.UserChannel(userID), authx.SessionRevocationSignal).Err(); err != nil {
		log.Printf("session revocation notification failed: %v", err)
	}
}
