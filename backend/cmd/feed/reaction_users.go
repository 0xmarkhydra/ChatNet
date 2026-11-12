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

func (s *server) listPostReactionUsers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.canReadPost(r.Context(), id, claims.UserID) {
		httpx.Error(w, http.StatusNotFound, "post not found")
		return
	}

	offset := 0
	if raw := r.URL.Query().Get("offset"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 || parsed > 10000 {
			httpx.Error(w, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = parsed
	}

	emoji := r.URL.Query().Get("emoji")
	if len(emoji) > 32 {
		httpx.Error(w, http.StatusBadRequest, "invalid emoji")
		return
	}

	rows, err := s.db.Query(r.Context(), `
    SELECT pl.user_id, u.username, u.display_name, pl.emoji
    FROM post_likes pl JOIN users u ON u.id=pl.user_id
    WHERE pl.post_id=$1 AND ($4 = '' OR pl.emoji = $4) AND NOT EXISTS(
      SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=pl.user_id) OR
        (b.blocked_id=$2 AND b.blocker_id=pl.user_id))
    ORDER BY pl.created_at DESC, pl.user_id DESC
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