package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const feedAccessSQL = `NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
 (b.blocker_id=$2 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$2)) AND (p.user_id=$2 OR p.visibility='public' OR
 (p.visibility='friends' AND EXISTS(SELECT 1 FROM friend_connections fc
 WHERE fc.user_low=LEAST(p.user_id,$2) AND fc.user_high=GREATEST(p.user_id,$2)
 AND fc.status='accepted')))`

func validVisibility(s string) bool { return s == "public" || s == "friends" || s == "private" }
func validBackground(s string) bool {
	switch s {
	case "", "violet", "blue", "sunset", "mint", "night":
		return true
	}
	return false
}
func feedID(w http.ResponseWriter, s string) (int64, bool) {
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id < 1 {
		httpx.Error(w, 400, "invalid id")
		return 0, false
	}
	return id, true
}
func (s *server) canReadPost(ctx context.Context, id, uid int64) bool {
	var ok bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM posts p WHERE p.id=$1 AND `+feedAccessSQL+`)`, id, uid).Scan(&ok)
	return err == nil && ok
}
func (s *server) respondPost(w http.ResponseWriter, r *http.Request, id, uid int64, status int) {
	var p post
	err := s.db.QueryRow(r.Context(), `SELECT p.id,u.username,u.display_name,p.content,p.likes_count,p.created_at,
 p.visibility,p.background,p.updated_at,
 EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=$2),
 EXISTS(SELECT 1 FROM saved_posts WHERE post_id=p.id AND user_id=$2)
 FROM posts p JOIN users u ON u.id=p.user_id
 WHERE p.id=$1 AND `+feedAccessSQL, id, uid).Scan(
		&p.ID, &p.Author, &p.AuthorDisplayName, &p.Content, &p.Likes, &p.CreatedAt,
		&p.Visibility, &p.Background, &p.UpdatedAt, &p.Liked, &p.Saved)
	if err != nil {
		httpx.Error(w, 404, "post not found")
		return
	}
	p.Comments = s.comments(r, p.ID)
	p.Attachments = s.postAttachments(r.Context(), p.ID)
	httpx.JSON(w, status, p)
}
func (s *server) detailPost(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	c, _ := authx.ClaimsFromContext(r.Context())
	s.respondPost(w, r, id, c.UserID, 200)
}
func (s *server) editPost(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	c, _ := authx.ClaimsFromContext(r.Context())
	var b struct{ Content, Visibility, Background string }
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32*1024))
	d.DisallowUnknownFields()
	if d.Decode(&b) != nil || d.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "invalid body")
		return
	}
	b.Content = strings.TrimSpace(b.Content)
	if !validVisibility(b.Visibility) || !validBackground(b.Background) || utf8.RuneCountInString(b.Content) > 5000 {
		httpx.Error(w, 400, "invalid post")
		return
	}
	if b.Content == "" {
		var media bool
		err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM post_attachments a JOIN posts p ON p.id=a.post_id WHERE a.post_id=$1 AND p.user_id=$2)`, id, c.UserID).Scan(&media)
		if err != nil {
			httpx.Error(w, 500, "cannot check media")
			return
		}
		if !media {
			httpx.Error(w, 400, "post needs text or media")
			return
		}
	}
	tag, err := s.db.Exec(r.Context(), `UPDATE posts SET content=$1,visibility=$2,background=$3,updated_at=NOW() WHERE id=$4 AND user_id=$5`, b.Content, b.Visibility, b.Background, id, c.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot update post")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "post not found")
		return
	}
	s.respondPost(w, r, id, c.UserID, 200)
}
func (s *server) deletePost(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	c, _ := authx.ClaimsFromContext(r.Context())
	tag, err := s.db.Exec(r.Context(), `DELETE FROM posts WHERE id=$1 AND user_id=$2`, id, c.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot delete post")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "post not found")
		return
	}
	w.WriteHeader(204)
}
func (s *server) toggleSave(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	c, _ := authx.ClaimsFromContext(r.Context())
	if !s.canReadPost(r.Context(), id, c.UserID) {
		httpx.Error(w, 404, "post not found")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot save")
		return
	}
	defer tx.Rollback(r.Context())
	tag, err := tx.Exec(r.Context(), `DELETE FROM saved_posts WHERE post_id=$1 AND user_id=$2`, id, c.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot update saved")
		return
	}
	if tag.RowsAffected() == 0 {
		if _, err = tx.Exec(r.Context(), `INSERT INTO saved_posts(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, id, c.UserID); err != nil {
			httpx.Error(w, 500, "cannot save")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, 500, "cannot commit")
		return
	}
	s.respondPost(w, r, id, c.UserID, 200)
}
func (s *server) editComment(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	cid, ok := feedID(w, r.PathValue("commentId"))
	if !ok {
		return
	}
	c, _ := authx.ClaimsFromContext(r.Context())
	var b struct{ Content string }
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024))
	d.DisallowUnknownFields()
	if d.Decode(&b) != nil || d.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "invalid body")
		return
	}
	b.Content = strings.TrimSpace(b.Content)
	if b.Content == "" || utf8.RuneCountInString(b.Content) > 1000 {
		httpx.Error(w, 400, "invalid comment")
		return
	}
	tag, err := s.db.Exec(r.Context(), `UPDATE comments c SET content=$1,updated_at=NOW()
 WHERE c.id=$4 AND c.post_id=$3 AND c.user_id=$2
 AND EXISTS(SELECT 1 FROM posts p WHERE p.id=c.post_id AND `+feedAccessSQL+`)`, b.Content, c.UserID, id, cid)
	if err != nil {
		httpx.Error(w, 500, "cannot edit comment")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "comment not found")
		return
	}
	s.respondPost(w, r, id, c.UserID, 200)
}
func (s *server) deleteComment(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	cid, ok := feedID(w, r.PathValue("commentId"))
	if !ok {
		return
	}
	c, _ := authx.ClaimsFromContext(r.Context())
	tag, err := s.db.Exec(r.Context(), `DELETE FROM comments c WHERE c.id=$1 AND c.post_id=$3 AND c.user_id=$2
 AND EXISTS(SELECT 1 FROM posts p WHERE p.id=c.post_id AND `+feedAccessSQL+`)`, cid, c.UserID, id)
	if err != nil {
		httpx.Error(w, 500, "cannot delete comment")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "comment not found")
		return
	}
	s.respondPost(w, r, id, c.UserID, 200)
}
func (s *server) reportFeed(w http.ResponseWriter, r *http.Request) {
	c, _ := authx.ClaimsFromContext(r.Context())
	if !s.allowFeedWrite(w, r, "report", 10, time.Hour) {
		return
	}
	var b struct {
		TargetType string
		TargetID   int64
		Reason     string
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	d.DisallowUnknownFields()
	if d.Decode(&b) != nil || d.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "invalid body")
		return
	}
	b.Reason = strings.TrimSpace(b.Reason)
	if b.TargetID < 1 || (b.TargetType != "post" && b.TargetType != "comment" && b.TargetType != "story") ||
		utf8.RuneCountInString(b.Reason) < 5 || utf8.RuneCountInString(b.Reason) > 500 {
		httpx.Error(w, 400, "invalid report")
		return
	}
	var allowed bool
	var err error
	switch b.TargetType {
	case "post":
		allowed = s.canReadPost(r.Context(), b.TargetID, c.UserID)
	case "comment":
		err = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=$1 AND `+feedAccessSQL+`)`, b.TargetID, c.UserID).Scan(&allowed)
	case "story":
		err = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM stories WHERE id=$1 AND expires_at>NOW())`, b.TargetID).Scan(&allowed)
	}
	if err != nil {
		httpx.Error(w, 500, "cannot check report")
		return
	}
	if !allowed {
		httpx.Error(w, 404, "content not found")
		return
	}
	_, err = s.db.Exec(r.Context(), `INSERT INTO feed_reports(reporter_id,target_type,target_id,reason) VALUES($1,$2,$3,$4) ON CONFLICT(reporter_id,target_type,target_id) DO UPDATE SET reason=EXCLUDED.reason,status='pending',created_at=NOW()`, c.UserID, b.TargetType, b.TargetID, b.Reason)
	if err != nil {
		httpx.Error(w, 500, "cannot save report")
		return
	}
	httpx.JSON(w, 201, map[string]string{"status": "received"})
}
