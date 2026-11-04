package main

import (
	"errors"
	"net/http"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type pinnedMessage struct {
	Message  message   `json:"message"`
	PinnedAt time.Time `json:"pinnedAt"`
}

// Conversation pins belong to one user, not the whole group.
func (s *server) setConversationPin(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.isMember(r.Context(), id, claims.UserID) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}
	if !s.allowDirectConversation(w, r, id, claims.UserID) {
		return
	}

	pinned := r.Method == http.MethodPut
	var pinnedAt *time.Time
	err := s.db.QueryRow(r.Context(), `
		UPDATE conversation_members
		SET pinned_at=CASE WHEN $3::boolean THEN COALESCE(pinned_at,NOW()) ELSE NULL END
		WHERE conversation_id=$1 AND user_id=$2
		RETURNING pinned_at`, id, claims.UserID, pinned).Scan(&pinnedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot change conversation pin")
		return
	}
	s.publishConversationEvent(r.Context(), []int64{claims.UserID}, realtimeEvent{
		Type: "conversation.updated", ConversationID: id,
	})
	httpx.JSON(w, http.StatusOK, map[string]any{"conversationId": id, "pinned": pinnedAt != nil})
}

// Only current members see shared pins. Blocked senders' messages are never returned.
func (s *server) listPinnedMessages(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.isMember(r.Context(), id, claims.UserID) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}
	if !s.allowDirectConversation(w, r, id, claims.UserID) {
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT mp.message_id,mp.pinned_at
		FROM message_pins mp
		JOIN messages m ON m.id=mp.message_id
		WHERE m.conversation_id=$1 AND m.deleted_at IS NULL
		  AND NOT EXISTS (
		    SELECT 1 FROM user_blocks b
		    WHERE (b.blocker_id=$2 AND b.blocked_id=m.user_id)
		       OR (b.blocked_id=$2 AND b.blocker_id=m.user_id)
		  )
		ORDER BY mp.pinned_at DESC, mp.message_id DESC
		LIMIT 100`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load pinned messages")
		return
	}
	type pinRow struct {
		id int64
		at time.Time
	}
	pins := []pinRow{}
	for rows.Next() {
		var item pinRow
		if err := rows.Scan(&item.id, &item.at); err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "cannot load pinned messages")
			return
		}
		pins = append(pins, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load pinned messages")
		return
	}
	items := make([]pinnedMessage, 0, len(pins))
	for _, pin := range pins {
		m, err := s.loadMessage(r.Context(), pin.id, claims.UserID)
		if err == nil && !m.Deleted {
			items = append(items, pinnedMessage{Message: m, PinnedAt: pin.at})
		}
	}
	httpx.JSON(w, http.StatusOK, items)
}

// In direct chats either member may pin; in groups only owner/admin may change shared pins.
func canChangeMessagePin(conversationType, role string) bool {
	return conversationType == "direct" || (conversationType == "group" && (role == "owner" || role == "admin"))
}

func (s *server) setMessagePin(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	pinned := r.Method == http.MethodPut
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot change message pin")
		return
	}
	defer tx.Rollback(r.Context())

	var conversationID, senderID int64
	var conversationType, role string
	var deleted bool
	err = tx.QueryRow(r.Context(), `
		SELECT m.conversation_id,m.user_id,c.type,cm.role,m.deleted_at IS NOT NULL
		FROM messages m
		JOIN conversations c ON c.id=m.conversation_id
		JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=$2
		WHERE m.id=$1
		FOR SHARE OF m,cm`, id, claims.UserID).
		Scan(&conversationID, &senderID, &conversationType, &role, &deleted)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusForbidden, "message unavailable or not a member")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot check message pin permissions")
		return
	}
	if !canChangeMessagePin(conversationType, role) {
		httpx.Error(w, http.StatusForbidden, "group admin permission required")
		return
	}
	if deleted && pinned {
		httpx.Error(w, http.StatusConflict, "cannot pin a recalled message")
		return
	}
	if !s.allowDirectConversation(w, r, conversationID, claims.UserID) {
		return
	}
	blocked, err := s.blockedPair(r.Context(), claims.UserID, senderID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot check message permissions")
		return
	}
	if blocked {
		httpx.Error(w, http.StatusForbidden, "message unavailable")
		return
	}

	var changed bool
	if pinned {
		tag, execErr := tx.Exec(r.Context(), `
			INSERT INTO message_pins(message_id,pinned_by) VALUES($1,$2)
			ON CONFLICT(message_id) DO NOTHING`, id, claims.UserID)
		err = execErr
		changed = err == nil && tag.RowsAffected() > 0
	} else {
		tag, execErr := tx.Exec(r.Context(), `DELETE FROM message_pins WHERE message_id=$1`, id)
		err = execErr
		changed = err == nil && tag.RowsAffected() > 0
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot change message pin")
		return
	}
	if changed && conversationType == "group" {
		action := "message.unpinned"
		if pinned {
			action = "message.pinned"
		}
		if err := writeGroupAudit(r.Context(), tx, conversationID, claims.UserID,
			action, nil, map[string]any{"messageId": id}); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot record message pin action")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot change message pin")
		return
	}
	if changed {
		s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
			Type: "pins.updated", ConversationID: conversationID,
		})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"conversationId": conversationID, "messageId": id, "pinned": pinned,
	})
}
