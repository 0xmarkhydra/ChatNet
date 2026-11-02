package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type postReaction struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
}

func (s *server) attachPostReactions(ctx context.Context, p *post, viewerID int64) error {
	p.Reactions = []postReaction{}
	p.MyReaction = ""
	p.Liked = false
	rows, err := s.db.Query(ctx, `
    SELECT emoji,COUNT(*)::int,BOOL_OR(user_id=$2)
    FROM post_likes WHERE post_id=$1 GROUP BY emoji
    ORDER BY COUNT(*) DESC, emoji
  `, p.ID, viewerID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var reaction postReaction
		var mine bool
		if err := rows.Scan(&reaction.Emoji, &reaction.Count, &mine); err != nil {
			return err
		}
		if mine {
			p.MyReaction = reaction.Emoji
			p.Liked = true
		}
		p.Reactions = append(p.Reactions, reaction)
	}
	return rows.Err()
}

func validPostReaction(emoji string) bool {
	switch emoji {
	case "👍", "❤️", "😂", "😮", "😢", "😡":
		return true
	}
	return false
}

func (s *server) react(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Emoji string `json:"emoji"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF || !validPostReaction(body.Emoji) {
		httpx.Error(w, http.StatusBadRequest, "unsupported reaction")
		return
	}
	s.changePostReaction(w, r, body.Emoji)
}

// The old /like route stays compatible with existing web/mobile consumers.
func (s *server) changePostReaction(w http.ResponseWriter, r *http.Request, emoji string) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.canReadPost(r.Context(), id, claims.UserID) {
		httpx.Error(w, http.StatusNotFound, "post not found")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot update reaction")
		return
	}
	defer tx.Rollback(r.Context())
	var lockedID int64
	if err := tx.QueryRow(r.Context(), `SELECT id FROM posts WHERE id=$1 FOR UPDATE`, id).Scan(&lockedID); err != nil {
		httpx.Error(w, 404, "post not found")
		return
	}
	var previous string
	err = tx.QueryRow(r.Context(), `SELECT emoji FROM post_likes WHERE post_id=$1 AND user_id=$2`, id, claims.UserID).Scan(&previous)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 500, "cannot read reaction")
		return
	}
	delta := 0
	switch {
	case previous == emoji:
		_, err = tx.Exec(r.Context(), `DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2`, id, claims.UserID)
		delta = -1
	case previous == "":
		_, err = tx.Exec(r.Context(), `INSERT INTO post_likes(post_id,user_id,emoji) VALUES($1,$2,$3)`, id, claims.UserID, emoji)
		delta = 1
	default:
		_, err = tx.Exec(r.Context(), `UPDATE post_likes SET emoji=$3,created_at=NOW() WHERE post_id=$1 AND user_id=$2`, id, claims.UserID, emoji)
	}
	if err != nil {
		httpx.Error(w, 500, "cannot save reaction")
		return
	}
	if delta != 0 {
		if _, err = tx.Exec(r.Context(), `UPDATE posts SET likes_count=GREATEST(likes_count+$2,0) WHERE id=$1`, id, delta); err != nil {
			httpx.Error(w, 500, "cannot update reaction count")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, 500, "cannot commit reaction")
		return
	}
	s.respondPost(w, r, id, claims.UserID, http.StatusOK)
}
