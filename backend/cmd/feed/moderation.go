package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

// Privileges are granted only by a database administrator via feed_moderators.
func (s *server) isFeedModerator(r *http.Request, userID int64) (bool, error) {
	var allowed bool
	err := s.db.QueryRow(r.Context(),
		"SELECT EXISTS(SELECT 1 FROM feed_moderators WHERE user_id=$1)", userID,
	).Scan(&allowed)
	return allowed, err
}

type moderationReport struct {
	ID         int64      `json:"id"`
	TargetType string     `json:"targetType"`
	TargetID   int64      `json:"targetId"`
	Reporter   string     `json:"reporter"`
	Reason     string     `json:"reason"`
	Preview    string     `json:"preview"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"createdAt"`
	ReviewedAt *time.Time `json:"reviewedAt,omitempty"`
}

func (s *server) listModerationReports(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	allowed, err := s.isFeedModerator(r, claims.UserID)
	if err != nil {
		httpx.Error(w, 503, "moderation unavailable")
		return
	}
	if !allowed {
		httpx.Error(w, 403, "moderation permission required")
		return
	}
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "dismissed" && status != "removed" {
		httpx.Error(w, 400, "invalid status")
		return
	}
	limit := 30
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 100 {
			httpx.Error(w, 400, "invalid limit")
			return
		}
		limit = n
	}
	var before int64
	if raw := r.URL.Query().Get("before"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || n < 1 {
			httpx.Error(w, 400, "invalid before cursor")
			return
		}
		before = n
	}
	rows, err := s.db.Query(r.Context(), `
        SELECT fr.id,fr.target_type,fr.target_id,u.username,fr.reason,
               COALESCE(CASE fr.target_type
                 WHEN 'post' THEN (SELECT LEFT(p.content,500) FROM posts p WHERE p.id=fr.target_id)
                 WHEN 'comment' THEN (SELECT LEFT(c.content,500) FROM comments c WHERE c.id=fr.target_id)
                 WHEN 'story' THEN (SELECT 'Story ('||st.kind||')' FROM stories st WHERE st.id=fr.target_id)
               END,'[Nội dung không còn tồn tại]'),
               fr.status,fr.created_at,fr.reviewed_at
        FROM feed_reports fr JOIN users u ON u.id=fr.reporter_id
        WHERE fr.status=$1 AND ($2::bigint=0 OR fr.id<$2)
        ORDER BY fr.id DESC LIMIT $3
    `, status, before, limit)
	if err != nil {
		httpx.Error(w, 503, "cannot load moderation reports")
		return
	}
	defer rows.Close()
	items := []moderationReport{}
	for rows.Next() {
		var item moderationReport
		if err := rows.Scan(&item.ID, &item.TargetType, &item.TargetID, &item.Reporter,
			&item.Reason, &item.Preview, &item.Status, &item.CreatedAt, &item.ReviewedAt); err != nil {
			httpx.Error(w, 500, "cannot read moderation reports")
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "cannot read moderation reports")
		return
	}
	httpx.JSON(w, 200, items)
}

func (s *server) reviewModerationReport(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body struct {
		Decision string `json:"decision"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "invalid body")
		return
	}
	body.Decision = strings.ToLower(strings.TrimSpace(body.Decision))
	if body.Decision != "dismiss" && body.Decision != "remove" {
		httpx.Error(w, 400, "decision must be dismiss or remove")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 503, "moderation unavailable")
		return
	}
	defer tx.Rollback(r.Context())

	// Holding this lock prevents revocation of review privileges mid-action.
	var moderatorID int64
	if err := tx.QueryRow(r.Context(),
		"SELECT user_id FROM feed_moderators WHERE user_id=$1 FOR SHARE", claims.UserID,
	).Scan(&moderatorID); err != nil {
		httpx.Error(w, 403, "moderation permission required")
		return
	}
	var targetType, status string
	var targetID int64
	if err := tx.QueryRow(r.Context(),
		"SELECT target_type,target_id,status FROM feed_reports WHERE id=$1 FOR UPDATE", id,
	).Scan(&targetType, &targetID, &status); err != nil {
		httpx.Error(w, 404, "report not found")
		return
	}
	if status != "pending" {
		httpx.Error(w, 409, "report already reviewed")
		return
	}
	if body.Decision == "remove" {
		// A removed target becomes inaccessible via all existing feed read paths.
		var query string
		switch targetType {
		case "post":
			query = "DELETE FROM posts WHERE id=$1"
		case "comment":
			query = "DELETE FROM comments WHERE id=$1"
		case "story":
			query = "DELETE FROM stories WHERE id=$1"
		default:
			httpx.Error(w, 400, "unsupported content type")
			return
		}
		if _, err := tx.Exec(r.Context(), query, targetID); err != nil {
			httpx.Error(w, 500, "cannot remove reported content")
			return
		}
		// Resolve duplicate reports on the same target in one transaction.
		_, err = tx.Exec(r.Context(), `
            UPDATE feed_reports SET status='removed',reviewed_by=$1,reviewed_at=NOW()
            WHERE target_type=$2 AND target_id=$3 AND status='pending'
        `, claims.UserID, targetType, targetID)
	} else {
		_, err = tx.Exec(r.Context(), `
            UPDATE feed_reports SET status='dismissed',reviewed_by=$1,reviewed_at=NOW()
            WHERE id=$2 AND status='pending'
        `, claims.UserID, id)
	}
	if err != nil {
		httpx.Error(w, 500, "cannot review report")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, 500, "cannot save moderation decision")
		return
	}
	httpx.JSON(w, 200, map[string]any{"id": id, "status": map[bool]string{true: "removed", false: "dismissed"}[body.Decision == "remove"]})
}
