package main

import (
	"encoding/json"
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

// An unread marker is private and independent of delivered read receipts.
func (s *server) setConversationReadState(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var input struct {
		Unread *bool `json:"unread"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 256)).Decode(&input) != nil || input.Unread == nil {
		httpx.Error(w, 400, "invalid read state")
		return
	}
	if !s.allowDirectConversation(w, r, id, claims.UserID) {
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 503, "cannot update read state")
		return
	}
	defer tx.Rollback(r.Context())
	var kind string
	if err = tx.QueryRow(r.Context(), `SELECT c.type FROM conversation_members cm JOIN conversations c ON c.id=cm.conversation_id WHERE cm.conversation_id=$1 AND cm.user_id=$2 FOR UPDATE OF cm`, id, claims.UserID).Scan(&kind); err != nil {
		httpx.Error(w, 403, "not a conversation member")
		return
	}
	var lastRead int64
	if !*input.Unread {
		if kind == "group" {
			_, err = tx.Exec(r.Context(), `INSERT INTO group_channel_reads(conversation_id,user_id,channel_id,last_read_message_id)
    SELECT $1,$2,ch.id,GREATEST(cm.cleared_through_message_id,COALESCE((SELECT MAX(m.id) FROM messages m WHERE m.conversation_id=$1 AND COALESCE(m.channel_id,0)=ch.id
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR (b.blocked_id=$2 AND b.blocker_id=m.user_id))),0))
    FROM conversation_members cm CROSS JOIN (SELECT 0::bigint AS id UNION ALL SELECT id FROM group_channels WHERE conversation_id=$1 AND deleted_at IS NULL) ch
    WHERE cm.conversation_id=$1 AND cm.user_id=$2
    ON CONFLICT(conversation_id,user_id,channel_id) DO UPDATE SET last_read_message_id=GREATEST(group_channel_reads.last_read_message_id,EXCLUDED.last_read_message_id),updated_at=NOW()`, id, claims.UserID)
		} else {
			err = tx.QueryRow(r.Context(), `UPDATE conversation_members SET last_read_message_id=GREATEST(last_read_message_id,COALESCE((SELECT MAX(m.id) FROM messages m WHERE m.conversation_id=$1 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR (b.blocked_id=$2 AND b.blocker_id=m.user_id))),0)) WHERE conversation_id=$1 AND user_id=$2 RETURNING last_read_message_id`, id, claims.UserID).Scan(&lastRead)
		}
	}
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE conversation_members SET manual_unread=$3 WHERE conversation_id=$1 AND user_id=$2`, id, claims.UserID, *input.Unread)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot update read state")
		return
	}
	if !*input.Unread && kind == "direct" {
		s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "conversation.read", ConversationID: id, ReaderID: claims.UserID, LastReadMessageID: lastRead})
	}
	s.publishConversationEvent(r.Context(), []int64{claims.UserID}, realtimeEvent{Type: "conversation.updated", ConversationID: id})
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, map[string]any{"conversationId": id, "manualUnread": *input.Unread})
}
