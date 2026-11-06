package main

import (
	"errors"
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

// Clear is private to the signed-in member. Other members keep their history.
func (s *server) clearConversationHistory(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var cutoff int64
	err := s.db.QueryRow(r.Context(), `
		UPDATE conversation_members cm
		SET cleared_through_message_id=GREATEST(cm.cleared_through_message_id,
		    COALESCE((SELECT MAX(m.id) FROM messages m WHERE m.conversation_id=cm.conversation_id),0)),
		    last_read_message_id=GREATEST(cm.last_read_message_id,
		    COALESCE((SELECT MAX(m.id) FROM messages m WHERE m.conversation_id=cm.conversation_id),0))
		WHERE cm.conversation_id=$1 AND cm.user_id=$2
		RETURNING cm.cleared_through_message_id
	`, conversationID, claims.UserID).Scan(&cutoff)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot clear conversation history")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]int64{"clearedThroughMessageId": cutoff})
}
