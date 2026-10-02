package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/database"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
	"chatnet/internal/objectstore"
	"chatnet/internal/onesignalx"
	"github.com/jackc/pgx/v5/pgxpool"
)

type comment struct {
	ID        int64     `json:"id"`
	Author    string    `json:"author"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

type post struct {
	ID          int64               `json:"id"`
	Author      string              `json:"author"`
	Content     string              `json:"content"`
	Likes       int                 `json:"likes"`
	Liked       bool                `json:"liked"`
	Comments    []comment           `json:"comments"`
	Attachments []mediax.Attachment `json:"attachments,omitempty"`
	CreatedAt   time.Time           `json:"createdAt"`
}

type server struct {
	db        *pgxpool.Pool
	jwtSecret string
	push      *onesignalx.Client
	storage   *objectstore.Client
}

func main() {
	ctx := context.Background()
	db, err := database.Open(ctx, config.Env("DATABASE_URL", "postgres://chatnet:chatnet@localhost:5432/chatnet?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	s := &server{
		db:        db,
		jwtSecret: config.Env("JWT_SECRET", "dev-secret-change-me"),
		push:      onesignalx.New(config.Env("ONESIGNAL_APP_ID", ""), config.Env("ONESIGNAL_REST_API_KEY", "")),
		storage:   objectstore.NewFromEnv(),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "feed"})
	})
	mux.Handle("GET /api/posts", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.list)))
	mux.Handle("POST /api/posts", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.create)))
	mux.Handle("POST /api/posts/{id}/like", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.like)))
	mux.Handle("POST /api/posts/{id}/comments", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.addComment)))

	port := config.Env("PORT", "8083")
	log.Printf("feed service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func (s *server) list(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `
		SELECT p.id,u.username,p.content,p.likes_count,p.created_at
		FROM posts p JOIN users u ON u.id=p.user_id
		ORDER BY p.id DESC LIMIT 100`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load posts")
		return
	}
	defer rows.Close()

	posts := []post{}
	for rows.Next() {
		var p post
		if rows.Scan(&p.ID, &p.Author, &p.Content, &p.Likes, &p.CreatedAt) != nil {
			continue
		}
		_ = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2)`, p.ID, claims.UserID).Scan(&p.Liked)
		p.Comments = s.comments(r, p.ID)
		p.Attachments = s.postAttachments(r.Context(), p.ID)
		posts = append(posts, p)
	}
	httpx.JSON(w, http.StatusOK, posts)
}

func (s *server) comments(r *http.Request, postID int64) []comment {
	rows, err := s.db.Query(r.Context(), `
		SELECT c.id,u.username,c.content,c.created_at
		FROM comments c JOIN users u ON u.id=c.user_id
		WHERE c.post_id=$1 ORDER BY c.id ASC`, postID)
	if err != nil {
		return []comment{}
	}
	defer rows.Close()

	items := []comment{}
	for rows.Next() {
		var c comment
		if rows.Scan(&c.ID, &c.Author, &c.Content, &c.CreatedAt) == nil {
			items = append(items, c)
		}
	}
	return items
}

func (s *server) postAttachments(ctx context.Context, postID int64) []mediax.Attachment {
	rows, err := s.db.Query(ctx, `
		SELECT id,storage_ref,original_name,content_type,size_bytes,kind
		FROM post_attachments
		WHERE post_id=$1
		ORDER BY position,id`, postID)
	if err != nil {
		return []mediax.Attachment{}
	}
	defer rows.Close()

	items := []mediax.Attachment{}
	for rows.Next() {
		var attachment mediax.Attachment
		if rows.Scan(
			&attachment.ID,
			&attachment.StorageRef,
			&attachment.Name,
			&attachment.ContentType,
			&attachment.SizeBytes,
			&attachment.Kind,
		) == nil {
			mediax.SignAttachment(s.storage, &attachment)
			items = append(items, attachment)
		}
	}
	return items
}

func (s *server) create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Content     string                   `json:"content"`
		Attachments []mediax.AttachmentInput `json:"attachments"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.Content = strings.TrimSpace(body.Content)
	if len(body.Content) > 5000 {
		httpx.Error(w, http.StatusBadRequest, "content must be <= 5000 characters")
		return
	}

	attachments, err := mediax.ValidateAttachments(
		r.Context(),
		s.storage,
		"feed",
		claims.UserID,
		body.Attachments,
		mediax.MaxFeedAttachments,
	)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.Content == "" && len(attachments) == 0 {
		httpx.Error(w, http.StatusBadRequest, "post content or attachment is required")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create post")
		return
	}
	defer tx.Rollback(r.Context())

	var p post
	p.Author = claims.Username
	p.Attachments = attachments
	err = tx.QueryRow(r.Context(), `
		INSERT INTO posts(user_id,content)
		VALUES($1,$2)
		RETURNING id,content,likes_count,created_at`,
		claims.UserID, body.Content,
	).Scan(&p.ID, &p.Content, &p.Likes, &p.CreatedAt)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create post")
		return
	}

	for position, attachment := range attachments {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO post_attachments(
				post_id,storage_ref,original_name,content_type,size_bytes,kind,position
			) VALUES($1,$2,$3,$4,$5,$6,$7)`,
			p.ID,
			attachment.StorageRef,
			attachment.Name,
			attachment.ContentType,
			attachment.SizeBytes,
			attachment.Kind,
			position,
		); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot save post attachment")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save post")
		return
	}

	p.Comments = []comment{}
	httpx.JSON(w, http.StatusCreated, p)
}

func (s *server) like(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusBadRequest, "invalid post id")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot update like")
		return
	}
	defer tx.Rollback(r.Context())

	tag, err := tx.Exec(r.Context(), `
		INSERT INTO post_likes(post_id,user_id)
		VALUES($1,$2) ON CONFLICT DO NOTHING`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "post not found")
		return
	}

	liked := tag.RowsAffected() > 0
	if liked {
		if _, err := tx.Exec(r.Context(), `UPDATE posts SET likes_count=likes_count+1 WHERE id=$1`, id); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot update like")
			return
		}
	} else {
		tag, err = tx.Exec(r.Context(), `DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2`, id, claims.UserID)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot update like")
			return
		}
		if tag.RowsAffected() > 0 {
			if _, err := tx.Exec(r.Context(), `UPDATE posts SET likes_count=GREATEST(likes_count-1,0) WHERE id=$1`, id); err != nil {
				httpx.Error(w, http.StatusInternalServerError, "cannot update like")
				return
			}
		}
	}

	var p post
	err = tx.QueryRow(r.Context(), `
		SELECT p.id,u.username,p.content,p.likes_count,p.created_at
		FROM posts p JOIN users u ON u.id=p.user_id
		WHERE p.id=$1`, id,
	).Scan(&p.ID, &p.Author, &p.Content, &p.Likes, &p.CreatedAt)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "post not found")
		return
	}
	p.Liked = liked

	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save like")
		return
	}
	p.Comments = s.comments(r, p.ID)
	p.Attachments = s.postAttachments(r.Context(), p.ID)
	httpx.JSON(w, http.StatusOK, p)
}

func (s *server) addComment(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	postID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid post id")
		return
	}
	var body struct {
		Content string `json:"content"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.Content = strings.TrimSpace(body.Content)
	if body.Content == "" || len(body.Content) > 1000 {
		httpx.Error(w, http.StatusBadRequest, "content is required and must be <= 1000 characters")
		return
	}

	if _, err := s.db.Exec(r.Context(),
		`INSERT INTO comments(post_id,user_id,content) VALUES($1,$2,$3)`,
		postID, claims.UserID, body.Content,
	); err != nil {
		httpx.Error(w, http.StatusBadRequest, "cannot create comment")
		return
	}

	var postOwnerID int64
	_ = s.db.QueryRow(r.Context(), `SELECT user_id FROM posts WHERE id=$1`, postID).Scan(&postOwnerID)
	if postOwnerID > 0 && postOwnerID != claims.UserID && s.push.Configured() {
		go func(ownerID, id int64) {
			ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
			defer cancel()

			rows, err := s.db.Query(ctx, `
				SELECT subscription_id::text
				FROM push_subscriptions
				WHERE user_id=$1
				ORDER BY updated_at DESC`, ownerID)
			if err != nil {
				log.Printf("load comment push subscriptions failed: %v", err)
				return
			}
			defer rows.Close()

			subscriptionIDs := []string{}
			for rows.Next() {
				var subscriptionID string
				if rows.Scan(&subscriptionID) == nil && subscriptionID != "" {
					subscriptionIDs = append(subscriptionIDs, subscriptionID)
				}
			}
			if len(subscriptionIDs) == 0 {
				return
			}

			if err := s.push.SendToSubscriptions(ctx, subscriptionIDs, onesignalx.Notification{
				Title: "ChatNet",
				Body:  "Có người vừa bình luận bài viết của bạn.",
				URL:   "https://chat.codelocal.cloud/?tab=feed",
				Data:  map[string]any{"type": "post.comment", "postId": id},
			}); err != nil {
				log.Printf("onesignal comment notification failed: %v", err)
			}
		}(postOwnerID, postID)
	}

	var p post
	err = s.db.QueryRow(r.Context(), `
		SELECT p.id,u.username,p.content,p.likes_count,p.created_at
		FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$1`, postID,
	).Scan(&p.ID, &p.Author, &p.Content, &p.Likes, &p.CreatedAt)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "post not found")
		return
	}
	p.Comments = s.comments(r, p.ID)
	p.Attachments = s.postAttachments(r.Context(), p.ID)
	httpx.JSON(w, http.StatusCreated, p)
}
