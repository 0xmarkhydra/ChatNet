package main

import (
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

const storyHighlightLimit = 100

type storyHighlight struct {
	story
	Title string `json:"title"`
}

func (s *server) listStoryHighlights(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	username := strings.TrimSpace(r.URL.Query().Get("username"))
	if username == "" || len(username) > 128 {
		httpx.Error(w, http.StatusBadRequest, "invalid highlight owner")
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT s.id,u.username,u.display_name,COALESCE(s.storage_ref,''),COALESCE(s.original_name,''),
		       COALESCE(s.content_type,''),COALESCE(s.size_bytes,0),s.kind,
		       COALESCE(s.text_content,''),COALESCE(s.text_background,''),s.created_at,s.expires_at,s.highlight_title
		FROM stories s JOIN users u ON u.id=s.user_id
		WHERE u.username=$1 AND s.highlight_title IS NOT NULL AND `+storyNotBlockedSQL+`
		ORDER BY s.created_at DESC,s.id DESC LIMIT $3`, username, claims.UserID, storyHighlightLimit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story highlights")
		return
	}
	defer rows.Close()
	items := []storyHighlight{}
	for rows.Next() {
		var item storyHighlight
		var attachment mediax.Attachment
		if err := rows.Scan(&item.ID, &item.Author, &item.AuthorDisplayName, &attachment.StorageRef, &attachment.Name,
			&attachment.ContentType, &attachment.SizeBytes, &attachment.Kind, &item.Text, &item.Background,
			&item.CreatedAt, &item.ExpiresAt, &item.Title); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot load story highlights")
			return
		}
		if attachment.Kind != "text" {
			mediax.SignAttachment(s.storage, &attachment)
			item.Attachment = &attachment
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story highlights")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) changeStoryHighlight(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := storyID(w, r)
	if !ok || !s.allowFeedWrite(w, r, "story-highlight", 40, time.Minute) {
		return
	}
	ctx := r.Context()
	if r.Method == http.MethodDelete {
		tag, err := s.db.Exec(ctx, `UPDATE stories SET highlight_title=NULL
			WHERE id=$1 AND user_id=$2 AND (highlight_title IS NOT NULL OR expires_at>NOW())`, id, claims.UserID)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot remove story highlight")
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.Error(w, http.StatusNotFound, "story not found")
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid highlight title")
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" || utf8.RuneCountInString(title) > 40 || strings.ContainsRune(title, 0) {
		httpx.Error(w, http.StatusBadRequest, "highlight title must contain 1 to 40 characters")
		return
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save story highlight")
		return
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('chatnet:story-highlights:' || $1::bigint::text,0))`, claims.UserID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save story highlight")
		return
	}
	var pinned bool
	err = tx.QueryRow(ctx, `SELECT highlight_title IS NOT NULL FROM stories
		WHERE id=$1 AND user_id=$2 AND (expires_at>NOW() OR highlight_title IS NOT NULL)
		FOR UPDATE`, id, claims.UserID).Scan(&pinned)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "story not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save story highlight")
		return
	}
	if !pinned {
		var count int
		if err := tx.QueryRow(ctx, "SELECT count(*) FROM stories WHERE user_id=$1 AND highlight_title IS NOT NULL", claims.UserID).Scan(&count); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot save story highlight")
			return
		}
		if count >= storyHighlightLimit {
			httpx.Error(w, http.StatusConflict, "too many story highlights")
			return
		}
	}
	if _, err := tx.Exec(ctx, "UPDATE stories SET highlight_title=$2 WHERE id=$1", id, title); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save story highlight")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save story highlight")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
