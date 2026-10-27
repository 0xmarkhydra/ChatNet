package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"time"

	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

var sessionIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type sessionManagementRequest struct {
	RefreshToken string `json:"refreshToken"`
	SessionID    string `json:"sessionId,omitempty"`
}

type managedSession struct {
	ID         string    `json:"id"`
	UserAgent  string    `json:"userAgent"`
	CreatedAt  time.Time `json:"createdAt"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
	Current    bool      `json:"current"`
}

func readSessionManagementRequest(w http.ResponseWriter, r *http.Request, requireID bool) (sessionManagementRequest, bool) {
	w.Header().Set("Cache-Control", "no-store")
	var body sessionManagementRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF ||
		len(body.RefreshToken) != 43 || !tokenRE.MatchString(body.RefreshToken) ||
		(requireID && !sessionIDPattern.MatchString(body.SessionID)) ||
		(!requireID && body.SessionID != "") {
		httpx.Error(w, http.StatusBadRequest, "invalid session request")
		return sessionManagementRequest{}, false
	}
	return body, true
}

// The valid refresh credential is the authority for session administration.
// Never trust a caller-supplied userId, and never expose refresh-token hashes.
func (s *server) sessionOwner(r *http.Request, refreshToken string) (int64, string, error) {
	var userID int64
	var currentID string
	err := s.db.QueryRow(r.Context(), `
		SELECT user_id,session_id::text
		FROM auth_sessions
		WHERE token_hash=$1 AND expires_at>NOW()
	`, sessionHash(refreshToken)).Scan(&userID, &currentID)
	return userID, currentID, err
}

func (s *server) listSessions(w http.ResponseWriter, r *http.Request) {
	request, ok := readSessionManagementRequest(w, r, false)
	if !ok {
		return
	}
	userID, currentID, err := s.sessionOwner(r, request.RefreshToken)
	if err != nil {
		sessionError(w, err)
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT session_id::text,user_agent,created_at,last_seen_at,expires_at
		FROM auth_sessions
		WHERE user_id=$1 AND expires_at>NOW()
		ORDER BY last_seen_at DESC,created_at DESC
		LIMIT 100
	`, userID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot load sessions")
		return
	}
	defer rows.Close()
	items := []managedSession{}
	for rows.Next() {
		var item managedSession
		if err := rows.Scan(&item.ID, &item.UserAgent, &item.CreatedAt, &item.LastSeenAt, &item.ExpiresAt); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot load sessions")
			return
		}
		item.Current = item.ID == currentID
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot load sessions")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) revokeSession(w http.ResponseWriter, r *http.Request) {
	request, ok := readSessionManagementRequest(w, r, true)
	if !ok {
		return
	}
	// One statement binds the target to the owner of the active refresh token.
	// A leaked session ID alone never grants permission to revoke another user.
	var userID int64
	err := s.db.QueryRow(r.Context(), `
		DELETE FROM auth_sessions
		WHERE session_id=$2::uuid
		  AND user_id=(
		    SELECT user_id FROM auth_sessions
		    WHERE token_hash=$1 AND expires_at>NOW()
		  )
		RETURNING user_id
	`, sessionHash(request.RefreshToken), request.SessionID).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Do not leak whether the target exists on another account.
		httpx.Error(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke session")
		return
	}
	s.notifySessionRevoked(r.Context(), userID)
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) revokeOtherSessions(w http.ResponseWriter, r *http.Request) {
	request, ok := readSessionManagementRequest(w, r, false)
	if !ok {
		return
	}
	userID, _, err := s.sessionOwner(r, request.RefreshToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusUnauthorized, "session expired")
		} else {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot verify session")
		}
		return
	}
	// Keep current session even if an old tab races another revocation.
	tag, err := s.db.Exec(r.Context(), `
		DELETE FROM auth_sessions
		WHERE user_id=$1 AND token_hash<>$2
		  AND EXISTS(
		    SELECT 1 FROM auth_sessions
		    WHERE token_hash=$2 AND user_id=$1 AND expires_at>NOW()
		  )
	`, userID, sessionHash(request.RefreshToken))
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke other sessions")
		return
	}
	if tag.RowsAffected() > 0 {
		s.notifySessionRevoked(r.Context(), userID)
	}
	w.WriteHeader(http.StatusNoContent)
}
