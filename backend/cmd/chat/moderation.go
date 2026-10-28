package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

const (
	maxDailyFriendRequests = 30
	maxDailyUserReports    = 10
)

// blockedPair is the source-of-truth privacy check for chat discovery and
// direct contact. Direction does not matter for visibility/contact.
func (s *server) blockedPair(ctx context.Context, a, b int64) (bool, error) {
	var blocked bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_blocks
			WHERE (blocker_id=$1 AND blocked_id=$2)
			   OR (blocker_id=$2 AND blocked_id=$1)
		)`, a, b).Scan(&blocked)
	return blocked, err
}

// Direct messages cannot be opened or delivered while either participant
// blocks the other. Group membership and group-message policy are separate.
func (s *server) blockedDirectConversation(ctx context.Context, conversationID, userID int64) (bool, error) {
	var blocked bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM conversations c
			JOIN conversation_members member ON member.conversation_id=c.id
			JOIN user_blocks b ON
				(b.blocker_id=$2 AND b.blocked_id=member.user_id)
				OR (b.blocked_id=$2 AND b.blocker_id=member.user_id)
			WHERE c.id=$1 AND c.type='direct' AND member.user_id<>$2
		)
	`, conversationID, userID).Scan(&blocked)
	return blocked, err
}

func (s *server) allowDirectConversation(w http.ResponseWriter, r *http.Request, conversationID, userID int64) bool {
	blocked, err := s.blockedDirectConversation(r.Context(), conversationID, userID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify conversation policy")
		return false
	}
	if blocked {
		httpx.Error(w, http.StatusForbidden, "direct contact is blocked")
		return false
	}
	return true
}

func (s *server) blockUser(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	targetID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if targetID == claims.UserID {
		httpx.Error(w, http.StatusBadRequest, "cannot block yourself")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot block user")
		return
	}
	defer tx.Rollback(r.Context())
	var id int64
	err = tx.QueryRow(r.Context(), `
		INSERT INTO user_blocks(blocker_id,blocked_id)
		SELECT $1,id FROM users WHERE id=$2
		ON CONFLICT(blocker_id,blocked_id) DO UPDATE SET blocker_id=EXCLUDED.blocker_id
		RETURNING blocked_id`, claims.UserID, targetID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot block user")
		return
	}
	low, high := orderedUserPair(claims.UserID, targetID)
	if _, err = tx.Exec(r.Context(), "DELETE FROM friend_connections WHERE user_low=$1 AND user_high=$2", low, high); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot block user")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot block user")
		return
	}
	s.publishConversationEvent(r.Context(), []int64{claims.UserID, targetID}, realtimeEvent{Type: "friend.updated"})
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "userId": id, "blocked": true})
}

func (s *server) unblockUser(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	targetID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if targetID == claims.UserID {
		httpx.Error(w, http.StatusBadRequest, "cannot unblock yourself")
		return
	}
	_, err := s.db.Exec(r.Context(), `
		DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, claims.UserID, targetID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot unblock user")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "userId": targetID, "blocked": false})
}

func (s *server) listBlockedUsers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	w.Header().Set("Cache-Control", "no-store")
	rows, err := s.db.Query(r.Context(), `
		SELECT u.id,u.username,u.display_name
		FROM user_blocks b JOIN users u ON u.id=b.blocked_id
		WHERE b.blocker_id=$1 ORDER BY b.created_at DESC,u.id DESC
		LIMIT 500`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot list blocked users")
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var username, displayName string
		if err := rows.Scan(&id, &username, &displayName); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot list blocked users")
			return
		}
		items = append(items, map[string]any{"id": id, "username": username, "displayName": displayName})
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot list blocked users")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) reportUser(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	targetID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if targetID == claims.UserID {
		httpx.Error(w, http.StatusBadRequest, "cannot report yourself")
		return
	}
	var body struct {
		Reason  string `json:"reason"`
		Details string `json:"details"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid report")
		return
	}
	body.Details = strings.TrimSpace(body.Details)
	if body.Reason != "spam" && body.Reason != "harassment" && body.Reason != "impersonation" && body.Reason != "other" ||
		utf8.RuneCountInString(body.Details) > 1000 {
		httpx.Error(w, http.StatusBadRequest, "invalid report reason or details")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot report user")
		return
	}
	defer tx.Rollback(r.Context())
	// Serialize per-reporter so simultaneous reports cannot exceed the quota.
	if _, err = tx.Exec(r.Context(), "SELECT pg_advisory_xact_lock($1::bigint)", claims.UserID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot report user")
		return
	}
	var exists bool
	err = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)", targetID).Scan(&exists)
	if err != nil || !exists {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}
	var count int
	err = tx.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM user_reports
		WHERE reporter_id=$1 AND created_at>NOW()-INTERVAL '24 hours'
	`, claims.UserID).Scan(&count)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot report user")
		return
	}
	if count >= maxDailyUserReports {
		httpx.Error(w, http.StatusTooManyRequests, "daily report limit reached")
		return
	}
	_, err = tx.Exec(r.Context(), `
		INSERT INTO user_reports(reporter_id,reported_id,reason,details)
		VALUES($1,$2,$3,$4)`, claims.UserID, targetID, body.Reason, body.Details)
	if err != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot report user")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true})
}
