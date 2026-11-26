package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

const storyNotBlockedSQL = `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
	(b.blocker_id=$2 AND b.blocked_id=s.user_id) OR
	(b.blocker_id=s.user_id AND b.blocked_id=$2))`

type storyLiker struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Emoji       string `json:"emoji"`
}

// A PUT without a body is the original heart-only client.
func storyReaction(w http.ResponseWriter, r *http.Request) (string, bool) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 256))
	if err == nil && len(bytes.TrimSpace(raw)) == 0 {
		return "❤️", true
	}
	var body struct {
		Emoji string `json:"emoji"`
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err != nil || decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF || !validPostReaction(body.Emoji) {
		httpx.Error(w, http.StatusBadRequest, "unsupported reaction")
		return "", false
	}
	return body.Emoji, true
}

func storyID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusBadRequest, "invalid story id")
		return 0, false
	}
	return id, true
}

func (s *server) getStoryLikes(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := storyID(w, r)
	if !ok {
		return
	}
	var after int64
	if value := r.URL.Query().Get("after"); value != "" {
		var err error
		after, err = strconv.ParseInt(value, 10, 64)
		if err != nil || after < 0 {
			httpx.Error(w, http.StatusBadRequest, "invalid cursor")
			return
		}
	}
	ctx := r.Context()
	var owner bool
	var emoji string
	err := s.db.QueryRow(ctx, `SELECT s.user_id=$2,
		COALESCE((SELECT l.emoji FROM story_likes l WHERE l.story_id=s.id AND l.user_id=$2),'')
		FROM stories s WHERE s.id=$1 AND s.expires_at>NOW() AND `+storyNotBlockedSQL, id, claims.UserID).Scan(&owner, &emoji)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "story not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story likes")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if !owner {
		httpx.JSON(w, http.StatusOK, struct {
			Liked bool   `json:"liked"`
			Emoji string `json:"emoji,omitempty"`
		}{emoji != "", emoji})
		return
	}

	const pageSize = 50
	rows, err := s.db.Query(ctx, `SELECT u.id,u.username,u.display_name,l.emoji FROM story_likes l
		JOIN stories s ON s.id=l.story_id
		JOIN users u ON u.id=l.user_id
		WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>NOW() AND u.id>$3
		  AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
		    (b.blocker_id=$2 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$2))
		ORDER BY u.id LIMIT $4`, id, claims.UserID, after, pageSize+1)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story likes")
		return
	}
	defer rows.Close()
	likers, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (storyLiker, error) {
		var liker storyLiker
		err := row.Scan(&liker.ID, &liker.Username, &liker.DisplayName, &liker.Emoji)
		return liker, err
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story likes")
		return
	}
	if likers == nil {
		likers = []storyLiker{}
	}
	var next int64
	if len(likers) > pageSize {
		likers = likers[:pageSize]
		next = likers[pageSize-1].ID
	}
	httpx.JSON(w, http.StatusOK, struct {
		Likers []storyLiker `json:"likers"`
		Next   int64        `json:"next,omitempty"`
	}{likers, next})
}

func (s *server) changeStoryLike(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := storyID(w, r)
	if !ok || !s.allowFeedWrite(w, r, "story-like", 60, time.Minute) {
		return
	}
	const allowed = `SELECT s.id FROM stories s
		WHERE s.id=$1 AND s.user_id<>$2 AND s.expires_at>NOW() AND ` + storyNotBlockedSQL
	var query string
	args := []any{id, claims.UserID}
	if r.Method == http.MethodPut {
		emoji, ok := storyReaction(w, r)
		if !ok {
			return
		}
		args = append(args, emoji)
		query = `WITH visible AS (` + allowed + `), changed AS (
			INSERT INTO story_likes(story_id,user_id,emoji) SELECT id,$2,$3 FROM visible
			ON CONFLICT (story_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji
		) SELECT EXISTS (SELECT 1 FROM visible)`
	} else {
		query = `WITH visible AS (` + allowed + `), changed AS (
			DELETE FROM story_likes WHERE story_id IN (SELECT id FROM visible) AND user_id=$2
		) SELECT EXISTS (SELECT 1 FROM visible)`
	}
	var visible bool
	if err := s.db.QueryRow(r.Context(), query, args...).Scan(&visible); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot update story like")
		return
	}
	if !visible {
		httpx.Error(w, http.StatusNotFound, "story not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
