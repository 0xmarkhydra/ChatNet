package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/onesignalx"
	"github.com/jackc/pgx/v5"
)

var mentionUsernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]{1,64}$`)

// Only the explicit, serialized tag line at the start of a post produces
// notifications. Ordinary @mentions in the body are not implicit tags.
func taggedUsernames(content string) []string {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	offset := 0
	if len(lines) > 0 && strings.HasPrefix(lines[0], "📍 ") {
		offset = 1
	}
	if offset >= len(lines) || !strings.HasPrefix(lines[offset], "👥 Cùng với ") {
		return nil
	}
	raw := strings.TrimPrefix(lines[offset], "👥 Cùng với ")
	items := strings.Split(raw, ",")
	if len(items) == 0 || len(items) > 10 {
		return nil
	}
	seen := make(map[string]bool, len(items))
	result := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if !strings.HasPrefix(item, "@") || !mentionUsernamePattern.MatchString(item[1:]) {
			return nil
		}
		username := strings.ToLower(item[1:])
		if !seen[username] {
			seen[username] = true
			result = append(result, username)
		}
	}
	return result
}

// syncPostMentions runs in the same database transaction as post creation/edit.
// Only accepted friends who can see the post and have not blocked each other
// receive alerts. Repeated edits and duplicates never notify twice.
func (s *server) syncPostMentions(ctx context.Context, tx pgx.Tx, postID, authorID int64, content, visibility string) ([]int64, error) {
	recipients := []int64{}
	usernames := taggedUsernames(content)
	if visibility != "private" && len(usernames) > 0 {
		rows, err := tx.Query(ctx, `
            SELECT u.id FROM users u
            WHERE lower(u.username) = ANY($1::text[])
              AND u.id <> $2
              AND EXISTS(
                SELECT 1 FROM friend_connections f
                WHERE f.user_low=LEAST($2,u.id)
                  AND f.user_high=GREATEST($2,u.id)
                  AND f.status='accepted'
              )
              AND NOT EXISTS(
                SELECT 1 FROM user_blocks b
                WHERE (b.blocker_id=$2 AND b.blocked_id=u.id)
                   OR (b.blocker_id=u.id AND b.blocked_id=$2)
              )
        `, usernames, authorID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return nil, err
			}
			recipients = append(recipients, id)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM post_mentions WHERE post_id=$1 AND NOT (user_id = ANY($2::bigint[]))`,
		postID, recipients); err != nil {
		return nil, err
	}
	if len(recipients) == 0 {
		return nil, nil
	}

	rows, err := tx.Query(ctx, `
        INSERT INTO post_mentions(post_id,user_id)
        SELECT $1, recipient FROM unnest($2::bigint[]) AS recipient
        ON CONFLICT(post_id,user_id) DO NOTHING
        RETURNING user_id
    `, postID, recipients)
	if err != nil {
		return nil, err
	}
	added := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		added = append(added, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	return added, nil
}

type postMention struct {
	ID                int64      `json:"id"`
	PostID            int64      `json:"postId"`
	Author            string     `json:"author"`
	AuthorDisplayName string     `json:"authorDisplayName"`
	CreatedAt         time.Time  `json:"createdAt"`
	ReadAt            *time.Time `json:"readAt,omitempty"`
}

func (s *server) listPostMentions(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `
        SELECT m.id, m.post_id, u.username, u.display_name, m.created_at, m.read_at
        FROM post_mentions m
        JOIN posts p ON p.id=m.post_id
        JOIN users u ON u.id=p.user_id
        WHERE m.user_id=$1 AND `+feedAccessSQL+`
        ORDER BY m.id DESC LIMIT 50
    `, claims.UserID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load post mentions")
		return
	}
	defer rows.Close()
	items := []postMention{}
	for rows.Next() {
		var item postMention
		if err := rows.Scan(&item.ID, &item.PostID, &item.Author,
			&item.AuthorDisplayName, &item.CreatedAt, &item.ReadAt); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot read post mention")
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot list post mentions")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) readPostMention(w http.ResponseWriter, r *http.Request) {
	id, ok := feedID(w, r.PathValue("id"))
	if !ok {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	tag, err := s.db.Exec(r.Context(), `
        UPDATE post_mentions m SET read_at=COALESCE(m.read_at,NOW())
        FROM posts p WHERE m.post_id=p.id AND m.id=$1 AND m.user_id=$2
        AND `+feedAccessSQL, id, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot read mention")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "mention not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) pushPostMentions(postID int64, authorName string, recipients []int64) {
	if len(recipients) == 0 || s.push == nil || !s.push.Configured() {
		return
	}
	ids := append([]int64(nil), recipients...)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		rows, err := s.db.Query(ctx, `
            SELECT DISTINCT subscription_id::text FROM push_subscriptions
            WHERE user_id=ANY($1::bigint[])
        `, ids)
		if err != nil {
			log.Printf("post mention subscriptions failed: %v", err)
			return
		}
		subscriptions := []string{}
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil && id != "" {
				subscriptions = append(subscriptions, id)
			}
		}
		if err := rows.Err(); err != nil {
			log.Printf("post mention subscription scan failed: %v", err)
		}
		rows.Close()
		if len(subscriptions) == 0 {
			return
		}
		err = s.push.SendToSubscriptions(ctx, subscriptions, onesignalx.Notification{
			Title: "ChatNet",
			Body:  fmt.Sprintf("%s đã gắn thẻ bạn trong một bài viết.", authorName),
			URL:   fmt.Sprintf("https://chat.codelocal.cloud/?tab=feed&post=%d", postID),
			Data:  map[string]any{"type": "post.mention", "postId": postID},
		})
		if err != nil {
			log.Printf("post mention push failed: %v", err)
		}
	}()
}
