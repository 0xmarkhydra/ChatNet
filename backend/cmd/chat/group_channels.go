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
)

type groupChannel struct {
	ID             int64  `json:"id"`
	ConversationID int64  `json:"conversationId"`
	Name           string `json:"name"`
	Description    string `json:"description"`
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
func (s *server) listGroupChannels(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if _, err := s.groupRole(r.Context(), id, claims.UserID); err != nil {
		httpx.Error(w, 403, "not a group member")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT id,conversation_id,name,description FROM group_channels WHERE conversation_id=$1 ORDER BY id LIMIT 30`, id)
	if err != nil {
		httpx.Error(w, 500, "cannot load channels")
		return
	}
	defer rows.Close()
	list := []groupChannel{{ID: 0, ConversationID: id, Name: "Thảo luận chung", Description: "Kênh mặc định của nhóm"}}
	for rows.Next() {
		var c groupChannel
		if rows.Scan(&c.ID, &c.ConversationID, &c.Name, &c.Description) != nil {
			httpx.Error(w, 500, "cannot load channels")
			return
		}
		list = append(list, c)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "cannot load channels")
		return
	}
	httpx.JSON(w, 200, list)
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
	role, cfg, err := groupGovernanceTx(r.Context(), tx, id, claims.UserID, true)
	if err != nil || !groupPermission(role, cfg, "edit") {
		httpx.Error(w, 403, "group edit permission required")
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
