package main

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type storyViewer struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Emoji       string `json:"emoji,omitempty"`
	// Absent for someone who reacted without a recorded view (older clients).
	ViewedAt *time.Time `json:"viewedAt,omitempty"`
}

// Everyone who viewed or reacted to story $1 owned by $2, minus blocked pairs.
const storyAudienceSQL = `WITH audience AS (
	SELECT user_id FROM story_views WHERE story_id=$1
	UNION SELECT user_id FROM story_likes WHERE story_id=$1
), visible AS (
	SELECT a.user_id FROM audience a
	WHERE a.user_id<>$2 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
		(b.blocker_id=$2 AND b.blocked_id=a.user_id) OR (b.blocker_id=a.user_id AND b.blocked_id=$2))
) `

func (s *server) recordStoryView(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := storyID(w, r)
	if !ok || !s.allowFeedWrite(w, r, "story-view", 300, time.Minute) {
		return
	}
	var visible bool
	err := s.db.QueryRow(r.Context(), `WITH visible AS (
		SELECT s.id FROM stories s
		WHERE s.id=$1 AND s.user_id<>$2 AND s.expires_at>NOW() AND `+storyNotBlockedSQL+`
	), recorded AS (
		INSERT INTO story_views(story_id,user_id) SELECT id,$2 FROM visible ON CONFLICT DO NOTHING
	) SELECT EXISTS (SELECT 1 FROM visible)`, id, claims.UserID).Scan(&visible)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot record story view")
		return
	}
	if !visible {
		httpx.Error(w, http.StatusNotFound, "story not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Owner only. Anyone else gets the same 404 as a missing story.
func (s *server) listStoryViews(w http.ResponseWriter, r *http.Request) {
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
	var total int
	err := s.db.QueryRow(ctx, storyAudienceSQL+`SELECT (SELECT COUNT(*)::int FROM visible)
		FROM stories s WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>NOW()`, id, claims.UserID).Scan(&total)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "story not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story views")
		return
	}

	const pageSize = 50
	rows, err := s.db.Query(ctx, storyAudienceSQL+`SELECT u.id,u.username,u.display_name,COALESCE(l.emoji,''),sv.viewed_at
		FROM visible a
		JOIN stories s ON s.id=$1 AND s.user_id=$2 AND s.expires_at>NOW()
		JOIN users u ON u.id=a.user_id
		LEFT JOIN story_views sv ON sv.story_id=s.id AND sv.user_id=u.id
		LEFT JOIN story_likes l ON l.story_id=s.id AND l.user_id=u.id
		WHERE u.id>$3 ORDER BY u.id LIMIT $4`, id, claims.UserID, after, pageSize+1)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story views")
		return
	}
	defer rows.Close()
	viewers, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (storyViewer, error) {
		var viewer storyViewer
		err := row.Scan(&viewer.ID, &viewer.Username, &viewer.DisplayName, &viewer.Emoji, &viewer.ViewedAt)
		return viewer, err
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story views")
		return
	}
	if viewers == nil {
		viewers = []storyViewer{}
	}
	var next int64
	if len(viewers) > pageSize {
		viewers = viewers[:pageSize]
		next = viewers[pageSize-1].ID
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, struct {
		Total   int           `json:"total"`
		Viewers []storyViewer `json:"viewers"`
		Next    int64         `json:"next,omitempty"`
	}{total, viewers, next})
}
