package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
	"github.com/jackc/pgx/v5"
)

func channelPathID(w http.ResponseWriter, r *http.Request, allowGeneral bool) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("channelId"), 10, 64)
	if err != nil || id < 0 || (!allowGeneral && id == 0) {
		httpx.Error(w, http.StatusBadRequest, "invalid channel id")
		return 0, false
	}
	return id, true
}

type channelMuteSetting struct {
	Muted bool `json:"muted"`
}

func (s *server) getChannelNotifications(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	groupID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	channelID, ok := channelPathID(w, r, true)
	if !ok {
		return
	}
	if _, err := s.groupRole(r.Context(), groupID, claims.UserID); err != nil {
		httpx.Error(w, 403, "not a group member")
		return
	}
	if !s.groupChannelExists(r.Context(), groupID, channelID) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	v := channelMuteSetting{}
	err := s.db.QueryRow(r.Context(), `SELECT muted FROM group_channel_notification_preferences
    WHERE conversation_id=$1 AND user_id=$2 AND channel_id=$3`,
		groupID, claims.UserID, channelID).Scan(&v.Muted)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 500, "cannot load channel notifications")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, v)
}

func (s *server) putChannelNotifications(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	groupID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	channelID, ok := channelPathID(w, r, true)
	if !ok {
		return
	}
	var v channelMuteSetting
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&v) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "invalid channel notification settings")
		return
	}
	if _, err := s.groupRole(r.Context(), groupID, claims.UserID); err != nil {
		httpx.Error(w, 403, "not a group member")
		return
	}
	if !s.groupChannelExists(r.Context(), groupID, channelID) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	tag, err := s.db.Exec(r.Context(), `INSERT INTO group_channel_notification_preferences
    (conversation_id,user_id,channel_id,muted)
    SELECT cm.conversation_id,cm.user_id,$3,$4 FROM conversation_members cm
    WHERE cm.conversation_id=$1 AND cm.user_id=$2
    ON CONFLICT(conversation_id,user_id,channel_id)
    DO UPDATE SET muted=EXCLUDED.muted,updated_at=NOW()`,
		groupID, claims.UserID, channelID, v.Muted)
	if err != nil {
		httpx.Error(w, 500, "cannot save channel notifications")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 403, "not a group member")
		return
	}
	s.publishConversationEvent(r.Context(), []int64{claims.UserID},
		realtimeEvent{Type: "conversation.updated", ConversationID: groupID})
	httpx.JSON(w, 200, v)
}

func (s *server) channelAvatarCapability(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	groupID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	channelID, ok := channelPathID(w, r, false)
	if !ok {
		return
	}
	role, settings, err := s.groupGovernance(r.Context(), groupID, claims.UserID)
	if err != nil || !groupPermission(role, settings, "edit") {
		httpx.Error(w, 403, "group edit permission required")
		return
	}
	if !s.groupChannelExists(r.Context(), groupID, channelID) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, map[string]bool{"canUpdateAvatar": true})
}

func (s *server) updateChannelAvatar(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	groupID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	channelID, ok := channelPathID(w, r, false)
	if !ok {
		return
	}
	role, settings, err := s.groupGovernance(r.Context(), groupID, claims.UserID)
	if err != nil || !groupPermission(role, settings, "edit") {
		httpx.Error(w, 403, "group edit permission required")
		return
	}
	if !s.groupChannelExists(r.Context(), groupID, channelID) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	var body groupAvatarUpdate
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "invalid image request")
		return
	}
	ref := ""
	if body.Attachment != nil {
		items, err := mediax.ValidateAttachments(r.Context(), s.storage, "profile", claims.UserID,
			[]mediax.AttachmentInput{*body.Attachment}, 1)
		if err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		if len(items) != 1 || items[0].Kind != "image" {
			httpx.Error(w, 400, "channel avatar must be an image")
			return
		}
		ref = items[0].StorageRef
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot update channel image")
		return
	}
	defer tx.Rollback(r.Context())
	role, settings, err = groupGovernanceTx(r.Context(), tx, groupID, claims.UserID, true)
	if err != nil || !groupPermission(role, settings, "edit") {
		httpx.Error(w, 403, "group edit permission required")
		return
	}
	tag, err := tx.Exec(r.Context(), `UPDATE group_channels
    SET avatar_ref=$1 WHERE conversation_id=$2 AND id=$3 AND deleted_at IS NULL`, ref, groupID, channelID)
	if err != nil {
		httpx.Error(w, 500, "cannot update channel image")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "channel not found")
		return
	}
	if err := writeGroupAudit(r.Context(), tx, groupID, claims.UserID, "channel.avatar.updated", nil,
		map[string]any{"channelId": channelID, "removed": ref == ""}); err != nil {
		httpx.Error(w, 500, "cannot record image update")
		return
	}
	if tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot save channel image")
		return
	}
	url := ""
	if ref != "" && s.storage != nil && s.storage.Configured() {
		url, _ = s.storage.SignedGetURL(ref, time.Hour)
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), groupID),
		realtimeEvent{Type: "conversation.updated", ConversationID: groupID})
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, map[string]any{
		"conversationId": groupID, "channelId": channelID, "avatarUrl": url, "avatarSet": ref != "",
	})
}
