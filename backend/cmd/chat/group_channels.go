package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"net/http"
	"strings"
	"time"
)

type groupChannel struct {
	ID             int64      `json:"id"`
	ConversationID int64      `json:"conversationId"`
	Name           string     `json:"name"`
	Description    string     `json:"description"`
	UnreadCount    int64      `json:"unreadCount"`
	LastMessage    string     `json:"lastMessage"`
	LastMessageAt  *time.Time `json:"lastMessageAt,omitempty"`
}
type channelFields struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func validChannel(v channelFields) bool {
	return len(strings.TrimSpace(v.Name)) > 0 && len([]rune(v.Name)) <= 80 && len([]rune(v.Description)) <= 500
}
func (s *server) groupChannelExists(ctx context.Context, groupID, channelID int64) bool {
	if channelID == 0 {
		return true
	}
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM group_channels WHERE conversation_id=$1 AND id=$2)`, groupID, channelID).Scan(&exists)
	return err == nil && exists
}

// listGroupChannels returns real per-channel unread counts and latest-message previews
// for the authenticated member. Read cursors are isolated by channel_id, including 0.
func (s *server) listGroupChannels(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if _, err := s.groupRole(r.Context(), id, claims.UserID); err != nil {
		httpx.Error(w, http.StatusForbidden, "not a group member")
		return
	}
	rows, err := s.db.Query(r.Context(), `
WITH rooms AS (
  SELECT 0::BIGINT id, $1::BIGINT conversation_id,
    'Thảo luận chung'::TEXT name, 'Kênh mặc định của nhóm'::TEXT description
  UNION ALL SELECT gc.id,gc.conversation_id,gc.name::TEXT,gc.description::TEXT
    FROM group_channels gc WHERE gc.conversation_id=$1
)
SELECT rooms.id,rooms.conversation_id,rooms.name,rooms.description,
  (SELECT COUNT(*) FROM messages m
    WHERE m.conversation_id=$1 AND COALESCE(m.channel_id,0)=rooms.id
      AND m.user_id<>$2
      AND m.id > GREATEST(COALESCE((
        SELECT gcr.last_read_message_id FROM group_channel_reads gcr
        WHERE gcr.conversation_id=$1 AND gcr.user_id=$2 AND gcr.channel_id=rooms.id
      ),cm.last_read_message_id),cm.cleared_through_message_id)
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR
        (b.blocked_id=$2 AND b.blocker_id=m.user_id))
  ) unread_count,
  COALESCE((
    SELECT CASE WHEN BTRIM(m.text)<>'' THEN m.text
      ELSE CASE WHEN EXISTS(SELECT 1 FROM message_attachments ma WHERE ma.message_id=m.id)
        THEN '[Tệp đính kèm]' ELSE '' END END
    FROM messages m WHERE m.conversation_id=$1 AND COALESCE(m.channel_id,0)=rooms.id
      AND m.id>cm.cleared_through_message_id
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR
        (b.blocked_id=$2 AND b.blocker_id=m.user_id))
    ORDER BY m.id DESC LIMIT 1
  ),'') last_message,
  (SELECT m.created_at FROM messages m
    WHERE m.conversation_id=$1 AND COALESCE(m.channel_id,0)=rooms.id
      AND m.id>cm.cleared_through_message_id
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR
        (b.blocked_id=$2 AND b.blocker_id=m.user_id))
    ORDER BY m.id DESC LIMIT 1
  ) last_message_at
FROM rooms
JOIN conversation_members cm ON cm.conversation_id=$1 AND cm.user_id=$2
ORDER BY rooms.id LIMIT 31
`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot load channels")
		return
	}
	defer rows.Close()
	list := []groupChannel{}
	for rows.Next() {
		var item groupChannel
		if err := rows.Scan(&item.ID, &item.ConversationID, &item.Name, &item.Description,
			&item.UnreadCount, &item.LastMessage, &item.LastMessageAt); err != nil {
			httpx.Error(w, 500, "cannot load channels")
			return
		}
		list = append(list, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "cannot load channels")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, list)
}

// markGroupChannelRead marks ONLY the selected room. It never advances another
// channel's cursor, and it cannot be used by someone outside the group.
func (s *server) markGroupChannelRead(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body struct {
		ChannelID int64 `json:"channelId"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256)).Decode(&body); err != nil || body.ChannelID < 0 {
		httpx.Error(w, 400, "invalid channel id")
		return
	}
	if _, err := s.groupRole(r.Context(), id, claims.UserID); err != nil {
		httpx.Error(w, 403, "not a group member")
		return
	}
	if !s.groupChannelExists(r.Context(), id, body.ChannelID) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	var lastRead int64
	err := s.db.QueryRow(r.Context(), `
INSERT INTO group_channel_reads(conversation_id,user_id,channel_id,last_read_message_id)
SELECT cm.conversation_id,cm.user_id,$3,
  GREATEST(cm.cleared_through_message_id,COALESCE((
    SELECT MAX(m.id) FROM messages m WHERE m.conversation_id=$1
      AND COALESCE(m.channel_id,0)=$3
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR
        (b.blocked_id=$2 AND b.blocker_id=m.user_id))
  ),0))
FROM conversation_members cm WHERE cm.conversation_id=$1 AND cm.user_id=$2
ON CONFLICT(conversation_id,user_id,channel_id)
DO UPDATE SET last_read_message_id=GREATEST(group_channel_reads.last_read_message_id,
  EXCLUDED.last_read_message_id),updated_at=NOW()
RETURNING last_read_message_id
`, id, claims.UserID, body.ChannelID).Scan(&lastRead)
	if err != nil {
		httpx.Error(w, 500, "cannot update channel read state")
		return
	}
	// Synchronize channel badges on the member's other logged-in devices.
	s.publishConversationEvent(r.Context(), []int64{claims.UserID}, realtimeEvent{Type: "conversation.updated", ConversationID: id})
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, map[string]any{"conversationId": id, "channelId": body.ChannelID, "lastReadMessageId": lastRead})
}
func channelConflict(err error) bool {
	var e *pgconn.PgError
	return errors.As(err, &e) && e.Code == "23505"
}
func (s *server) createGroupChannel(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body channelFields
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&body) != nil || !validChannel(body) {
		httpx.Error(w, 400, "invalid channel fields")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot create channel")
		return
	}
	defer tx.Rollback(r.Context())
	role, _, err := groupGovernanceTx(r.Context(), tx, id, claims.UserID, true)
	if err != nil || role != "owner" {
		httpx.Error(w, 403, "only group owner can create channels")
		return
	}
	var locked int64
	if err = tx.QueryRow(r.Context(), `SELECT id FROM conversations WHERE id=$1 AND type='group' FOR UPDATE`, id).Scan(&locked); err != nil {
		httpx.Error(w, 404, "group not found")
		return
	}
	var count int
	if err = tx.QueryRow(r.Context(), `SELECT COUNT(*) FROM group_channels WHERE conversation_id=$1`, id).Scan(&count); err != nil {
		httpx.Error(w, 500, "cannot create channel")
		return
	}
	if count >= 30 {
		httpx.Error(w, 409, "maximum 30 channels")
		return
	}
	var c groupChannel
	err = tx.QueryRow(r.Context(), `INSERT INTO group_channels(conversation_id,name,description,created_by)
  VALUES($1,$2,$3,$4) RETURNING id,conversation_id,name,description`,
		id, strings.TrimSpace(body.Name), strings.TrimSpace(body.Description), claims.UserID).Scan(&c.ID, &c.ConversationID, &c.Name, &c.Description)
	if channelConflict(err) {
		httpx.Error(w, 409, "channel name already exists")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "cannot create channel")
		return
	}
	if writeGroupAudit(r.Context(), tx, id, claims.UserID, "channel.created", nil, map[string]any{"channelId": c.ID}) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot create channel")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "conversation.updated", ConversationID: id})
	httpx.JSON(w, 201, c)
}
func (s *server) updateGroupChannel(w http.ResponseWriter, r *http.Request) {
	s.mutateGroupChannel(w, r, false)
}
func (s *server) deleteGroupChannel(w http.ResponseWriter, r *http.Request) {
	s.mutateGroupChannel(w, r, true)
}
func (s *server) mutateGroupChannel(w http.ResponseWriter, r *http.Request, remove bool) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	channelID, ok := parseID(w, r.PathValue("channelId"))
	if !ok {
		return
	}
	var body channelFields
	if !remove && (json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&body) != nil || !validChannel(body)) {
		httpx.Error(w, 400, "invalid channel fields")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot modify channel")
		return
	}
	defer tx.Rollback(r.Context())
	role, cfg, err := groupGovernanceTx(r.Context(), tx, id, claims.UserID, true)
	if err != nil || !groupPermission(role, cfg, "edit") {
		httpx.Error(w, 403, "group edit permission required")
		return
	}
	var c groupChannel
	if remove {
		var count int
		err = tx.QueryRow(r.Context(), `SELECT COUNT(*) FROM messages WHERE conversation_id=$1 AND channel_id=$2`, id, channelID).Scan(&count)
		if err != nil {
			httpx.Error(w, 500, "cannot remove channel")
			return
		}
		if count > 0 {
			httpx.Error(w, 409, "cannot remove a channel containing messages")
			return
		}
		err = tx.QueryRow(r.Context(), `DELETE FROM group_channels WHERE conversation_id=$1 AND id=$2 RETURNING id,conversation_id,name,description`, id, channelID).Scan(&c.ID, &c.ConversationID, &c.Name, &c.Description)
	} else {
		err = tx.QueryRow(r.Context(), `UPDATE group_channels SET name=$1,description=$2
   WHERE conversation_id=$3 AND id=$4 RETURNING id,conversation_id,name,description`,
			strings.TrimSpace(body.Name), strings.TrimSpace(body.Description), id, channelID).Scan(&c.ID, &c.ConversationID, &c.Name, &c.Description)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	if channelConflict(err) {
		httpx.Error(w, 409, "channel name already exists")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "cannot modify channel")
		return
	}
	action := "channel.updated"
	if remove {
		action = "channel.deleted"
	}
	if writeGroupAudit(r.Context(), tx, id, claims.UserID, action, nil, map[string]any{"channelId": channelID}) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot modify channel")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "conversation.updated", ConversationID: id})
	httpx.JSON(w, 200, c)
}
