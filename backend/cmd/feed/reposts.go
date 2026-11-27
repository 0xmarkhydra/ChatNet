package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
	"github.com/jackc/pgx/v5"
)

type repostPreview struct {
	ID                int64               `json:"id"`
	Author            string              `json:"author"`
	AuthorDisplayName string              `json:"authorDisplayName,omitempty"`
	Content           string              `json:"content"`
	Attachments       []mediax.Attachment `json:"attachments,omitempty"`
}

func (s *server) attachRepost(ctx context.Context, item *post, sourceID, viewer int64) error {
	if sourceID != 0 {
		var source repostPreview
		err := s.db.QueryRow(ctx, `
 SELECT p.id,u.username,u.display_name,p.content
 FROM posts p JOIN users u ON u.id=p.user_id
 WHERE p.id=$1 AND p.repost_of IS NULL AND p.visibility<>'private' AND `+directPostAccessSQL, sourceID, viewer).
			Scan(&source.ID, &source.Author, &source.AuthorDisplayName, &source.Content)
		if err != nil {
			return err
		}
		source.Attachments = s.postAttachments(ctx, sourceID)
		item.OriginalPost = &source
		return nil
	}
	if item.Visibility == "private" {
		return nil
	}
	return s.db.QueryRow(ctx, `
 SELECT COUNT(*)::int,COALESCE(MAX(p.id) FILTER (WHERE p.user_id=$2 AND p.repost_kind='quick'),0)
 FROM posts p WHERE p.repost_of=$1 AND `+directPostAccessSQL, item.ID, viewer).
		Scan(&item.RepostCount, &item.MyRepostID)
}

func (s *server) createRepost(w http.ResponseWriter, r *http.Request) {
	sourceID, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	var input struct{ Kind, Content string }
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 24*1024))
	d.DisallowUnknownFields()
	if d.Decode(&input) != nil || d.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "invalid body")
		return
	}
	input.Content = strings.TrimSpace(input.Content)
	if !validRepost(input.Kind, input.Content) {
		httpx.Error(w, 400, "invalid repost")
		return
	}
	if !s.allowFeedWrite(w, r, "repost", 25, time.Minute) {
		return
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		httpx.Error(w, 500, "cannot create repost")
		return
	}
	defer tx.Rollback(ctx)
	var sourceAuthor int64
	err = tx.QueryRow(ctx, `SELECT p.user_id FROM posts p
 WHERE p.id=$1 AND p.repost_of IS NULL AND p.visibility<>'private' AND `+directPostAccessSQL+` FOR SHARE OF p`, sourceID, claims.UserID).Scan(&sourceAuthor)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 404, "post not found")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "cannot check repost source")
		return
	}
	var repostID int64
	err = tx.QueryRow(ctx, `
 INSERT INTO posts(user_id,content,repost_of,repost_kind) VALUES($1,$2,$3,$4)
 ON CONFLICT (repost_of,user_id) WHERE repost_kind='quick' DO NOTHING RETURNING id`,
		claims.UserID, input.Content, sourceID, input.Kind).Scan(&repostID)
	if input.Kind == "quick" && errors.Is(err, pgx.ErrNoRows) {
		// A duplicate quick request doesn't publish or notify again.
		err = tx.Commit(ctx)
		if err != nil {
			httpx.Error(w, 500, "cannot finish repost")
			return
		}
		s.respondPost(w, r, sourceID, claims.UserID, 200)
		return
	}
	if err != nil {
		httpx.Error(w, 500, "cannot create repost")
		return
	}
	if sourceAuthor != claims.UserID {
		kind := "repost"
		if input.Kind == "quote" {
			kind = "quote"
		}
		if _, err = tx.Exec(ctx, `INSERT INTO post_mentions(post_id,user_id,kind) VALUES($1,$2,$3)`, repostID, sourceAuthor, kind); err != nil {
			httpx.Error(w, 500, "cannot notify post author")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, 500, "cannot save repost")
		return
	}
	if sourceAuthor != claims.UserID {
		s.publishFeedNotificationUpdate(r.Context(), []int64{sourceAuthor})
	}
	s.respondPost(w, r, sourceID, claims.UserID, 201)
}

func validRepost(kind, content string) bool {
	return kind == "quick" && content == "" || kind == "quote" && content != "" &&
		utf8.RuneCountInString(content) <= 5000 && !strings.ContainsRune(content, 0)
}

func (s *server) removeRepost(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allowFeedWrite(w, r, "repost", 25, time.Minute) {
		return
	}
	_, err := s.db.Exec(r.Context(), `DELETE FROM posts WHERE repost_of=$1 AND user_id=$2 AND repost_kind='quick'`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot remove repost")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
