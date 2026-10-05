package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
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
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body) != nil ||
		(body.RefreshToken != "" && (len(body.RefreshToken) != 43 || !tokenRE.MatchString(body.RefreshToken))) {
		httpx.Error(w, http.StatusBadRequest, "invalid refresh token")
		return "", false
	}
	return body.RefreshToken, true
}

func (s *server) startSession(w http.ResponseWriter, r *http.Request, u user, status int) {
	w.Header().Set("Cache-Control", "no-store")
	access, err := authx.Sign(s.jwtSecret, u.ID, u.Username, u.DisplayName)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create token")
		return
	}
	refresh, err := randomURL(32)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create session")
		return
	}
	// Delete expired credentials without extending the lifetime of active ones.
	_, err = s.db.Exec(r.Context(), `
		WITH expired AS (DELETE FROM auth_sessions WHERE expires_at <= NOW())
		INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)`,
		sessionHash(refresh), u.ID, time.Now().Add(sessionTTL))
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot save session")
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
	if refresh == "" {
		// Upgrade pre-refresh clients only while their signed access token is still valid.
		claims, err := authx.Parse(s.jwtSecret, authx.TokenFromRequest(r))
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "session expired")
			return
		}
		err = s.db.QueryRow(r.Context(), `
			SELECT id,email,username,display_name,created_at FROM users WHERE id=$1`, claims.UserID).
			Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.CreatedAt)
		if err != nil {
			sessionError(w, err)
			return
		}
		s.startSession(w, r, u, http.StatusOK)
		return
	}
	// ponytail: fixed 90-day bearer session supports concurrent tabs and retry after a lost response;
	// add rotating device sessions if device management becomes a product requirement.
	err := s.db.QueryRow(r.Context(), `
		SELECT u.id,u.email,u.username,u.display_name,u.created_at
		FROM auth_sessions s JOIN users u ON u.id=s.user_id
		WHERE s.token_hash=$1 AND s.expires_at > NOW()`, sessionHash(refresh)).
		Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.CreatedAt)
	if err != nil {
		sessionError(w, err)
		return
	}
	access, err := authx.Sign(s.jwtSecret, u.ID, u.Username, u.DisplayName)
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
		if _, err := s.db.Exec(r.Context(), "DELETE FROM auth_sessions WHERE token_hash=$1", sessionHash(refresh)); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke session")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}
