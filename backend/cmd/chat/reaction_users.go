package main

import (
	"net/http"
	"strconv"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

type reactionUser struct {
	UserID      int64  `json:"userId"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Emoji       string `json:"emoji"`
}

func (s *server) listMessageReactionUsers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}

	var conversationID int64
	err := s.db.QueryRow(r.Context(), `
    SELECT m.conversation_id FROM messages m
    WHERE m.id=$1 AND m.deleted_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR
        (b.blocked_id=$2 AND b.blocker_id=m.user_id))
  `, id, claims.UserID).Scan(&conversationID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "message not found")
		return
	}
	if !s.isMember(r.Context(), conversationID, claims.UserID) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}
	if !s.allowDirectConversation(w, r, conversationID, claims.UserID) {
		return
	}

	offset := 0
	if raw := r.URL.Query().Get("offset"); raw != "" {
		offset, err = strconv.Atoi(raw)
		if err != nil || offset < 0 || offset > 10000 {
			httpx.Error(w, http.StatusBadRequest, "invalid offset")
			return
		}
	}

	emoji := r.URL.Query().Get("emoji")
	if len(emoji) > 32 {
		httpx.Error(w, http.StatusBadRequest, "invalid emoji")
		return
	}

	rows, err := s.db.Query(r.Context(), `
    SELECT mr.user_id, u.username, u.display_name, mr.emoji
    FROM message_reactions mr JOIN users u ON u.id=mr.user_id
    WHERE mr.message_id=$1 AND ($4 = '' OR mr.emoji = $4) AND NOT EXISTS(
      SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=mr.user_id) OR
        (b.blocked_id=$2 AND b.blocker_id=mr.user_id))
    ORDER BY mr.created_at DESC, mr.user_id DESC
    LIMIT 51 OFFSET $3
  `, id, claims.UserID, offset, emoji)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load reaction users")
		return
	}
	defer rows.Close()

	items := make([]reactionUser, 0, 50)
	hasMore := false
	for rows.Next() {
		var item reactionUser
		if err := rows.Scan(&item.UserID, &item.Username, &item.DisplayName, &item.Emoji); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot read reaction users")
			return
		}
		if len(items) == 50 {
			hasMore = true
			break
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot read reaction users")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items, "hasMore": hasMore})
}