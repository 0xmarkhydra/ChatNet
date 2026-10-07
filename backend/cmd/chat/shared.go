package main

import (
	"net/http"
	"strconv"
	"strings"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

type sharedContentPage struct {
	Items      []message `json:"items"`
	NextBefore *int64    `json:"nextBefore,omitempty"`
}

func (s *server) listSharedContent(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.isMember(r.Context(), conversationID, claims.UserID) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}

	kind := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kind")))
	if kind == "" {
		kind = "media"
	}
	if kind != "media" && kind != "files" && kind != "links" {
		httpx.Error(w, http.StatusBadRequest, "kind must be media, files or links")
		return
	}

	limit := 48
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 50 {
			httpx.Error(w, http.StatusBadRequest, "limit must be between 1 and 50")
			return
		}
		limit = parsed
	}

	var before int64
	if raw := strings.TrimSpace(r.URL.Query().Get("before")); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || parsed <= 0 {
			httpx.Error(w, http.StatusBadRequest, "before must be a positive message id")
			return
		}
		before = parsed
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT m.id,m.conversation_id,m.user_id,u.username,m.text,m.created_at
		FROM messages m
		JOIN users u ON u.id=m.user_id
		WHERE m.conversation_id=$1
		  AND m.deleted_at IS NULL
		  AND ($2::bigint=0 OR m.id<$2)
		  AND (
		    ($3='media' AND EXISTS (
		      SELECT 1 FROM message_attachments ma
		      WHERE ma.message_id=m.id AND ma.kind IN ('image','video')
		    ))
		    OR
		    ($3='files' AND EXISTS (
		      SELECT 1 FROM message_attachments ma
		      WHERE ma.message_id=m.id AND ma.kind IN ('file','audio')
		    ))
		    OR
		    ($3='links' AND m.text ~* 'https?://')
		  )
		ORDER BY m.id DESC
		LIMIT $4
	`, conversationID, before, kind, limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load shared content")
		return
	}
	defer rows.Close()

	items := []message{}
	for rows.Next() {
		var item message
		if err := rows.Scan(
			&item.ID,
			&item.ConversationID,
			&item.SenderID,
			&item.Sender,
			&item.Text,
			&item.CreatedAt,
		); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot read shared content")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load shared content")
		return
	}
	if err := s.attachMessageMedia(r.Context(), items); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load shared attachments")
		return
	}

	page := sharedContentPage{Items: items}
	if len(items) == limit {
		next := items[len(items)-1].ID
		page.NextBefore = &next
	}
	httpx.JSON(w, http.StatusOK, page)
}
