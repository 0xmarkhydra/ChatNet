package main

import (
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

// A bounded response for native badges; never infer a total from a paginated list.
// Visibility matches listConversations: membership, direct blocks, and blocked senders in groups.
func (s *server) unreadSummary(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var count int64
	err := s.db.QueryRow(r.Context(), `
		SELECT COUNT(*)
		FROM conversation_members cm
		JOIN conversations c ON c.id=cm.conversation_id
		JOIN messages m ON m.conversation_id=c.id AND m.id>cm.last_read_message_id
		WHERE cm.user_id=$1 AND m.user_id<>$1
		  AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		    (b.blocker_id=$1 AND b.blocked_id=m.user_id) OR
		    (b.blocked_id=$1 AND b.blocker_id=m.user_id))
		  AND (c.type<>'direct' OR NOT EXISTS(
		    SELECT 1 FROM conversation_members other JOIN user_blocks b ON
		      (b.blocker_id=$1 AND b.blocked_id=other.user_id) OR
		      (b.blocked_id=$1 AND b.blocker_id=other.user_id)
		    WHERE other.conversation_id=c.id AND other.user_id<>$1
		  ))`, claims.UserID).Scan(&count)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot load unread count")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]int64{"unreadCount": count})
}
