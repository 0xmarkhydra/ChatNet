package main

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
)

// This endpoint allows clients to detect whether the deployed chat service
// supports persistent group avatars before uploading bytes to object storage.
// Older deployments return 404, avoiding orphan S3 objects.
func (s *server) groupAvatarCapability(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}
	groupID, valid := parseID(w, r.PathValue("id"))
	if !valid {
		return
	}
	role, settings, err := s.groupGovernance(r.Context(), groupID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "group not found")
		return
	}
	if !groupPermission(role, settings, "edit") {
		httpx.Error(w, http.StatusForbidden, "group edit permission required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]bool{"canUpdateAvatar": true})
}

// Group photos use the verified S3 profile image upload pipeline.
// The stored image is readable only to group members through signed URLs.
type groupAvatarUpdate struct {
	Attachment *mediax.AttachmentInput `json:"attachment"`
}

func (s *server) updateGroupAvatar(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}
	groupID, valid := parseID(w, r.PathValue("id"))
	if !valid {
		return
	}
	role, settings, err := s.groupGovernance(r.Context(), groupID, claims.UserID)
	if err != nil || !groupPermission(role, settings, "edit") {
		httpx.Error(w, http.StatusForbidden, "group edit permission required")
		return
	}

	var body groupAvatarUpdate
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid image request")
		return
	}
	storageRef := ""
	if body.Attachment != nil {
		items, err := mediax.ValidateAttachments(r.Context(), s.storage, "profile", claims.UserID,
			[]mediax.AttachmentInput{*body.Attachment}, 1)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(items) != 1 || items[0].Kind != "image" {
			httpx.Error(w, http.StatusBadRequest, "group avatar must be an image")
			return
		}
		storageRef = items[0].StorageRef
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot update image")
		return
	}
	defer tx.Rollback(r.Context())
	role, settings, err = groupGovernanceTx(r.Context(), tx, groupID, claims.UserID, true)
	if err != nil || !groupPermission(role, settings, "edit") {
		httpx.Error(w, http.StatusForbidden, "group edit permission required")
		return
	}

	tag, err := tx.Exec(r.Context(), `UPDATE conversations SET group_avatar_ref=$1 WHERE id=$2 AND type='group'`, storageRef, groupID)
	if err != nil || tag.RowsAffected() == 0 {
		status := http.StatusInternalServerError
		if err == nil {
			status = http.StatusNotFound
		}
		httpx.Error(w, status, "group or channel not found")
		return
	}
	if err := writeGroupAudit(r.Context(), tx, groupID, claims.UserID, "group.avatar.updated", nil,
		map[string]any{"removed": storageRef == ""}); err != nil {
		httpx.Error(w, 500, "cannot record image update")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, 500, "cannot save image")
		return
	}
	url := ""
	if storageRef != "" && s.storage != nil && s.storage.Configured() {
		url, _ = s.storage.SignedGetURL(storageRef, time.Hour)
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), groupID),
		realtimeEvent{Type: "conversation.updated", ConversationID: groupID})
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{
		"conversationId": groupID, "avatarUrl": url,
		"avatarSet": storageRef != "",
	})
}
