package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/database"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
	"chatnet/internal/objectstore"
	"chatnet/internal/onesignalx"
	"chatnet/internal/redisx"
	"chatnet/internal/searchx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type comment struct {
	Liked             bool       `json:"liked"`
	UpdatedAt         *time.Time `json:"updatedAt,omitempty"`
	ID                int64      `json:"id"`
	ParentID          *int64     `json:"parentId"`
	Author            string     `json:"author"`
	AuthorDisplayName string     `json:"authorDisplayName,omitempty"`
	Content           string     `json:"content"`
	CreatedAt         time.Time  `json:"createdAt"`
}

type post struct {
	PublishLocation   *postLocation       `json:"publishLocation,omitempty"`
	Visibility        string              `json:"visibility"`
	Background        string              `json:"background"`
	Saved             bool                `json:"saved"`
	UpdatedAt         time.Time           `json:"updatedAt"`
	ID                int64               `json:"id"`
	Author            string              `json:"author"`
	AuthorDisplayName string              `json:"authorDisplayName,omitempty"`
	Content           string              `json:"content"`
	Likes             int                 `json:"likes"`
	Liked             bool                `json:"liked"`
	MyReaction        string              `json:"myReaction,omitempty"`
	Reactions         []postReaction      `json:"reactions,omitempty"`
	Comments          []comment           `json:"comments"`
	Attachments       []mediax.Attachment `json:"attachments,omitempty"`
	CreatedAt         time.Time           `json:"createdAt"`
	RepostKind        string              `json:"repostKind,omitempty"`
	OriginalPost      *repostPreview      `json:"originalPost,omitempty"`
	RepostCount       int                 `json:"repostCount"`
	MyRepostID        int64               `json:"myRepostId,omitempty"`
}

type story struct {
	ID                int64              `json:"id"`
	Author            string             `json:"author"`
	AuthorDisplayName string             `json:"authorDisplayName,omitempty"`
	Attachment        *mediax.Attachment `json:"attachment,omitempty"`
	Text              string             `json:"text,omitempty"`
	Background        string             `json:"background,omitempty"`
	CreatedAt         time.Time          `json:"createdAt"`
	ExpiresAt         time.Time          `json:"expiresAt"`
}

const storyTextLimit = 200

const maxFeedComments = 50

type server struct {
	db               *pgxpool.Pool
	redis            *redis.Client
	jwtSecret        string
	push             *onesignalx.Client
	storage          *objectstore.Client
	deleteStoryMedia func(context.Context, string) error
}

type storyMediaCleanupJob struct {
	id         int64
	storageRef string
}

const storyMediaCleanupBatch = 50

// Keep completed refs blocked beyond the 10-minute upload URL lifetime.
const storyMediaCleanupReuseGuard = 15 * time.Minute

type feedRow struct {
	post
	originalID int64
	searchRank int
}

func main() {
	ctx := context.Background()
	jwtSecret, err := config.RequiredSecret("JWT_SECRET")
	if err != nil {
		log.Fatal(err)
	}
	db, err := database.Open(ctx, config.Env("DATABASE_URL", "postgres://chatnet:chatnet@localhost:5432/chatnet?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		log.Fatal(err)
	}
	rdb, err := redisx.Open(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer rdb.Close()

	s := &server{
		db:        db,
		redis:     rdb,
		jwtSecret: jwtSecret,
		push:      onesignalx.New(config.Env("ONESIGNAL_APP_ID", ""), config.Env("ONESIGNAL_REST_API_KEY", "")),
		storage:   objectstore.NewFromEnv(),
	}
	go s.processStoryMediaCleanup(ctx)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "feed"})
	})
	mux.HandleFunc("GET /live", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "feed"})
	})
	mux.HandleFunc("GET /ready", s.ready)
	mux.Handle("GET /api/posts", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.list)))
	mux.Handle("GET /api/posts/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.detailPost)))
	mux.Handle("PATCH /api/posts/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.editPost)))
	mux.Handle("DELETE /api/posts/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deletePost)))
	mux.Handle("POST /api/posts/{id}/save", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.toggleSave)))
	mux.Handle("PATCH /api/posts/{id}/comments/{commentId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.editComment)))
	mux.Handle("DELETE /api/posts/{id}/comments/{commentId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deleteComment)))
	mux.Handle("POST /api/feed/reports", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.reportFeed)))
	mux.Handle("GET /api/feed/moderation/me", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getModerationMe)))
	mux.Handle("GET /api/feed/moderation/reports", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listModerationReports)))
	mux.Handle("PATCH /api/feed/moderation/reports/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.reviewModerationReport)))
	mux.Handle("POST /api/posts/{id}/repost", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createRepost)))
	mux.Handle("DELETE /api/posts/{id}/repost", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.removeRepost)))
	mux.Handle("POST /api/posts", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.create)))
	mux.Handle("GET /api/feed/mentions", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listPostMentions)))
	mux.Handle("POST /api/feed/mentions/{id}/read", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.readPostMention)))
	mux.Handle("POST /api/posts/{id}/like", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.like)))
	mux.Handle("POST /api/posts/{id}/reactions", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.react)))
	mux.Handle("GET /api/posts/{id}/reactions", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listPostReactionUsers)))
	mux.Handle("POST /api/posts/{id}/comments", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.addComment)))
	mux.Handle("PUT /api/posts/{id}/comments/{commentId}/like", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.changeCommentLike)))
	mux.Handle("DELETE /api/posts/{id}/comments/{commentId}/like", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.changeCommentLike)))
	mux.Handle("GET /api/stories", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listStories)))
	mux.Handle("POST /api/stories", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createStory)))
	mux.Handle("DELETE /api/stories/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deleteStory)))
	mux.Handle("GET /api/stories/{id}/like", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getStoryLikes)))
	mux.Handle("PUT /api/stories/{id}/like", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.changeStoryLike)))
	mux.Handle("DELETE /api/stories/{id}/like", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.changeStoryLike)))
	mux.Handle("GET /api/stories/highlights", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listStoryHighlights)))
	mux.Handle("PUT /api/stories/{id}/highlight", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.changeStoryHighlight)))
	mux.Handle("DELETE /api/stories/{id}/highlight", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.changeStoryHighlight)))
	s.mountMarketplace(mux)

	port := config.Env("PORT", "8083")
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("feed service listening on :%s", port)
	log.Fatal(httpServer.ListenAndServe())
}

func (s *server) ready(w http.ResponseWriter, r *http.Request) {
	dependencies := map[string]string{"database": "ok", "redis": "ok"}
	dbCtx, dbCancel := context.WithTimeout(r.Context(), 500*time.Millisecond)
	defer dbCancel()
	if s.db == nil || s.db.Ping(dbCtx) != nil {
		dependencies["database"] = "unavailable"
	}
	redisCtx, redisCancel := context.WithTimeout(r.Context(), 500*time.Millisecond)
	defer redisCancel()
	if s.redis == nil || s.redis.Ping(redisCtx).Err() != nil {
		dependencies["redis"] = "unavailable"
	}
	ready := dependencies["database"] == "ok" && dependencies["redis"] == "ok"
	status, code := "ok", http.StatusOK
	if !ready {
		status, code = "not_ready", http.StatusServiceUnavailable
	}
	httpx.JSON(w, code, map[string]any{"status": status, "service": "feed", "dependencies": dependencies})
}

func (s *server) list(w http.ResponseWriter, r *http.Request) {
	page, paged, pageErr := searchx.ParsePageRequest(r.URL.Query())
	if pageErr != nil {
		httpx.Error(w, http.StatusBadRequest, pageErr.Error())
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	// Backwards-compatible default; clients using load-more request bounded pages.
	limit := 100
	if paged {
		limit = page.Limit + 1
	} else if value := r.URL.Query().Get("limit"); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil || n < 1 || n > 100 {
			httpx.Error(w, http.StatusBadRequest, "invalid limit (1-100)")
			return
		}
		limit = n
	}
	author := strings.TrimSpace(r.URL.Query().Get("author"))
	if paged {
		author = ""
	}
	if len(author) > 64 {
		httpx.Error(w, 400, "invalid author")
		return
	}
	// Search the complete authorized feed, not just posts already fetched by a client.
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if utf8.RuneCountInString(query) > 120 {
		httpx.Error(w, http.StatusBadRequest, "invalid search query (max 120 characters)")
		return
	}
	searchTerm := query
	// Treat LIKE metacharacters as literal input, not as user-supplied wildcards.
	query = strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(query)
	scope := r.URL.Query().Get("scope")
	if scope != "" && scope != "saved" && scope != "mine" && scope != "following" {
		httpx.Error(w, http.StatusBadRequest, "invalid scope")
		return
	}
	if scope == "" {
		scope = "all"
	}
	if paged {
		scope = "all"
	}
	var before int64
	if value := r.URL.Query().Get("before"); value != "" && !paged {
		n, err := strconv.ParseInt(value, 10, 64)
		if err != nil || n < 1 {
			httpx.Error(w, http.StatusBadRequest, "invalid before cursor")
			return
		}
		before = n
	}
	if paged && searchTerm == "" {
		httpx.JSON(w, http.StatusOK, map[string]any{"items": []post{}, "nextCursor": nil})
		return
	}
	var cursor postSearchCursor
	if paged && page.Cursor != "" {
		var err error
		cursor, err = searchx.DecodeCursor[postSearchCursor](page.Cursor)
		if err != nil || cursor.ID <= 0 || (page.Sort == "newest" && cursor.CreatedAt.IsZero()) ||
			(page.Sort == "relevance" && (cursor.Rank < 0 || cursor.Rank > 5)) {
			httpx.Error(w, http.StatusBadRequest, "invalid cursor")
			return
		}
	}
	rankSQL := "0"
	if paged {
		rankSQL = `CASE
			WHEN ` + searchx.FoldSQL("p.content") + `=` + searchx.FoldSQL("$7") + ` THEN 0
			WHEN strpos(` + searchx.FoldSQL("p.content") + `,` + searchx.FoldSQL("$7") + `)=1 THEN 1
			WHEN ` + searchx.FoldSQL("u.username") + `=` + searchx.FoldSQL("$7") + ` THEN 2
			WHEN strpos(` + searchx.FoldSQL("u.username") + `,` + searchx.FoldSQL("$7") + `)=1 THEN 3
			WHEN strpos(` + searchx.FoldSQL("u.display_name") + `,` + searchx.FoldSQL("$7") + `)=1 THEN 4
			ELSE 5 END`
	}
	querySQL := `
		SELECT p.id,u.username,u.display_name,p.content,p.likes_count,p.created_at,
		       p.visibility,p.background,p.updated_at,COALESCE(p.repost_kind,''),COALESCE(p.repost_of,0), CASE WHEN p.visibility='public' THEN p.publish_location END,
		       EXISTS(SELECT 1 FROM saved_posts x WHERE x.post_id=p.id AND x.user_id=$2),` + rankSQL + ` AS search_rank
		FROM posts p JOIN users u ON u.id=p.user_id
		WHERE ($1::bigint=0 OR p.id<$1) AND ($5='' OR u.username=$5) AND ` + feedAccessSQL + `
		  AND ($4='all' OR ($4='mine' AND p.user_id=$2)
		       OR ($4='saved' AND EXISTS(SELECT 1 FROM saved_posts x WHERE x.post_id=p.id AND x.user_id=$2))
		       OR ($4='following' AND (p.user_id=$2 OR EXISTS (
		         SELECT 1 FROM friend_connections f WHERE f.status='accepted'
		         AND ((f.user_low=$2 AND f.user_high=p.user_id) OR (f.user_high=$2 AND f.user_low=p.user_id))
		       ))))
		  AND ($6='' OR ` + searchx.FoldSQL("p.content") + ` LIKE '%' || ` + searchx.FoldSQL("$6") + ` || '%'
		       OR ` + searchx.FoldSQL("u.username") + ` LIKE '%' || ` + searchx.FoldSQL("$6") + ` || '%'
		       OR ` + searchx.FoldSQL("u.display_name") + ` LIKE '%' || ` + searchx.FoldSQL("$6") + ` || '%')`
	args := []any{before, claims.UserID, limit, scope, author, query}
	if paged {
		args = append(args, searchTerm, page.Since)
		querySQL += ` AND p.visibility='public' AND ($8::timestamptz IS NULL OR p.created_at >= $8)`
		if page.Cursor != "" {
			if page.Sort == "newest" {
				querySQL += ` AND (p.created_at,p.id)<($9::timestamptz,$10::bigint)`
				args = append(args, cursor.CreatedAt, cursor.ID)
			} else {
				querySQL += ` AND (` + rankSQL + `>$9 OR (` + rankSQL + `=$9 AND p.id<$10))`
				args = append(args, cursor.Rank, cursor.ID)
			}
		}
		if page.Sort == "newest" {
			querySQL += ` ORDER BY p.created_at DESC,p.id DESC`
		} else {
			querySQL += ` ORDER BY search_rank ASC,p.id DESC`
		}
	} else {
		querySQL += ` ORDER BY p.id DESC`
	}
	querySQL += ` LIMIT $3`
	rows, err := s.db.Query(r.Context(), querySQL, args...)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load posts")
		return
	}
	defer rows.Close()

	var entries []feedRow
	for rows.Next() {
		var p post
		var originalID int64
		var searchRank int
		if rows.Scan(&p.ID, &p.Author, &p.AuthorDisplayName, &p.Content, &p.Likes, &p.CreatedAt, &p.Visibility, &p.Background, &p.UpdatedAt, &p.RepostKind, &originalID, &p.PublishLocation, &p.Saved, &searchRank) != nil {
			continue
		}
		entries = append(entries, feedRow{post: p, originalID: originalID, searchRank: searchRank})
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load posts")
		return
	}
	rows.Close()
	hasMore := paged && len(entries) > page.Limit
	if hasMore {
		entries = entries[:page.Limit]
	}
	posts := make([]post, 0, len(entries))
	if len(entries) == 0 {
		if paged {
			httpx.JSON(w, http.StatusOK, map[string]any{"items": posts, "nextCursor": nil})
		} else {
			httpx.JSON(w, http.StatusOK, posts)
		}
		return
	}
	ids := make([]int64, 0, len(entries))
	originalIDs := make([]int64, 0, len(entries))
	for _, entry := range entries {
		ids = append(ids, entry.ID)
		if entry.originalID != 0 {
			originalIDs = append(originalIDs, entry.originalID)
		}
	}
	comments, err := s.commentsBatch(r.Context(), ids, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load comments")
		return
	}
	attachments, err := s.postAttachmentsBatch(r.Context(), append(ids, originalIDs...))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load attachments")
		return
	}
	if err := s.attachPostReactionsBatch(r.Context(), &entries, claims.UserID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load post reactions")
		return
	}
	if err := s.attachRepostsBatch(r.Context(), &entries, originalIDs, claims.UserID, attachments); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load repost")
		return
	}
	for _, entry := range entries {
		p := entry.post
		if entry.originalID != 0 && p.OriginalPost == nil {
			continue
		}
		p.Comments = comments[p.ID]
		p.Attachments = attachments[p.ID]
		posts = append(posts, p)
	}
	if paged {
		var nextCursor any
		if hasMore && len(entries) > 0 {
			last := entries[len(entries)-1]
			value := postSearchCursor{Rank: last.searchRank, ID: last.ID}
			if page.Sort == "newest" {
				value.CreatedAt = last.CreatedAt
			}
			encoded, err := searchx.EncodeCursor(value)
			if err != nil {
				httpx.Error(w, http.StatusInternalServerError, "cannot create search cursor")
				return
			}
			nextCursor = encoded
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"items": posts, "nextCursor": nextCursor})
		return
	}
	httpx.JSON(w, http.StatusOK, posts)
}

type postSearchCursor struct {
	Rank      int       `json:"r"`
	ID        int64     `json:"i"`
	CreatedAt time.Time `json:"t,omitempty"`
}

func (s *server) comments(r *http.Request, postID, viewerID int64) []comment {
	rows, err := s.db.Query(r.Context(), `
		SELECT c.id,c.parent_id,u.username,u.display_name,c.content,c.created_at,c.updated_at,
		       EXISTS(SELECT 1 FROM comment_likes l WHERE l.comment_id=c.id AND l.user_id=$2)
		FROM comments c JOIN users u ON u.id=c.user_id
		WHERE c.post_id=$1 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		  (b.blocker_id=$2 AND b.blocked_id=c.user_id) OR (b.blocked_id=$2 AND b.blocker_id=c.user_id))
		ORDER BY c.id ASC LIMIT $3`, postID, viewerID, maxFeedComments)
	if err != nil {
		return []comment{}
	}
	defer rows.Close()

	items := []comment{}
	for rows.Next() {
		var c comment
		if rows.Scan(&c.ID, &c.ParentID, &c.Author, &c.AuthorDisplayName, &c.Content, &c.CreatedAt, &c.UpdatedAt, &c.Liked) == nil {
			items = append(items, c)
		}
	}
	return items
}

func (s *server) commentsBatch(ctx context.Context, postIDs []int64, viewerID int64) (map[int64][]comment, error) {
	items := make(map[int64][]comment, len(postIDs))
	for _, id := range postIDs {
		items[id] = []comment{}
	}
	rows, err := s.db.Query(ctx, `
		SELECT visible.post_id,visible.id,visible.parent_id,visible.username,visible.display_name,
		       visible.content,visible.created_at,visible.updated_at,visible.liked
		FROM (SELECT DISTINCT unnest($1::bigint[]) AS post_id) AS requested
		JOIN LATERAL (
			SELECT c.post_id,c.id,c.parent_id,u.username,u.display_name,c.content,c.created_at,c.updated_at,
			       EXISTS(SELECT 1 FROM comment_likes l WHERE l.comment_id=c.id AND l.user_id=$2) AS liked
			FROM comments c JOIN users u ON u.id=c.user_id
			WHERE c.post_id=requested.post_id AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
			  (b.blocker_id=$2 AND b.blocked_id=c.user_id) OR (b.blocked_id=$2 AND b.blocker_id=c.user_id))
			ORDER BY c.id ASC LIMIT $3
		) visible ON true
		ORDER BY visible.post_id,visible.id`, postIDs, viewerID, maxFeedComments)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var postID int64
		var c comment
		if err := rows.Scan(&postID, &c.ID, &c.ParentID, &c.Author, &c.AuthorDisplayName, &c.Content, &c.CreatedAt, &c.UpdatedAt, &c.Liked); err != nil {
			return nil, err
		}
		items[postID] = append(items[postID], c)
	}
	return items, rows.Err()
}

func (s *server) postAttachments(ctx context.Context, postID int64) []mediax.Attachment {
	rows, err := s.db.Query(ctx, `
		SELECT id,storage_ref,original_name,content_type,size_bytes,kind
		FROM post_attachments
		WHERE post_id=$1
		ORDER BY position,id LIMIT $2`, postID, mediax.MaxFeedAttachments)
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

func (s *server) postAttachmentsBatch(ctx context.Context, postIDs []int64) (map[int64][]mediax.Attachment, error) {
	items := make(map[int64][]mediax.Attachment, len(postIDs))
	for _, id := range postIDs {
		items[id] = []mediax.Attachment{}
	}
	if len(postIDs) == 0 {
		return items, nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT visible.post_id,visible.id,visible.storage_ref,visible.original_name,visible.content_type,
		       visible.size_bytes,visible.kind
		FROM (SELECT DISTINCT unnest($1::bigint[]) AS post_id) AS requested
		JOIN LATERAL (
			SELECT a.post_id,a.id,a.storage_ref,a.original_name,a.content_type,a.size_bytes,a.kind
			FROM post_attachments a
			WHERE a.post_id=requested.post_id
			ORDER BY a.position,a.id LIMIT $2
		) visible ON true
		ORDER BY visible.post_id,visible.id`, postIDs, mediax.MaxFeedAttachments)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var postID int64
		var attachment mediax.Attachment
		if err := rows.Scan(&postID, &attachment.ID, &attachment.StorageRef, &attachment.Name, &attachment.ContentType, &attachment.SizeBytes, &attachment.Kind); err != nil {
			return nil, err
		}
		mediax.SignAttachment(s.storage, &attachment)
		items[postID] = append(items[postID], attachment)
	}
	return items, rows.Err()
}

func (s *server) attachPostReactionsBatch(ctx context.Context, entries *[]feedRow, viewerID int64) error {
	ids := make([]int64, 0, len(*entries))
	for i := range *entries {
		(*entries)[i].Reactions = []postReaction{}
		(*entries)[i].MyReaction = ""
		(*entries)[i].Liked = false
		ids = append(ids, (*entries)[i].ID)
	}
	if len(ids) == 0 {
		return nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT post_id,emoji,COUNT(*)::int,BOOL_OR(user_id=$2)
		FROM post_likes
		WHERE post_id=ANY($1::bigint[])
		GROUP BY post_id,emoji
		ORDER BY post_id,COUNT(*) DESC,emoji`, ids, viewerID)
	if err != nil {
		return err
	}
	defer rows.Close()
	byID := make(map[int64]*post, len(*entries))
	for i := range *entries {
		byID[(*entries)[i].ID] = &(*entries)[i].post
	}
	for rows.Next() {
		var postID int64
		var reaction postReaction
		var mine bool
		if err := rows.Scan(&postID, &reaction.Emoji, &reaction.Count, &mine); err != nil {
			return err
		}
		p := byID[postID]
		if p == nil {
			continue
		}
		p.Reactions = append(p.Reactions, reaction)
		if mine {
			p.MyReaction = reaction.Emoji
			p.Liked = true
		}
	}
	return rows.Err()
}

func (s *server) attachRepostsBatch(ctx context.Context, entries *[]feedRow, originalIDs []int64, viewerID int64, attachments map[int64][]mediax.Attachment) error {
	if len(originalIDs) > 0 {
		rows, err := s.db.Query(ctx, `
			SELECT p.id,u.username,u.display_name,p.content
			FROM posts p JOIN users u ON u.id=p.user_id
			WHERE p.id=ANY($1::bigint[]) AND p.repost_of IS NULL AND p.visibility<>'private' AND `+directPostAccessSQL, originalIDs, viewerID)
		if err != nil {
			return err
		}
		sources := make(map[int64]repostPreview, len(originalIDs))
		for rows.Next() {
			var source repostPreview
			if err := rows.Scan(&source.ID, &source.Author, &source.AuthorDisplayName, &source.Content); err != nil {
				rows.Close()
				return err
			}
			source.Attachments = attachments[source.ID]
			sources[source.ID] = source
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return err
		}
		rows.Close()
		for i := range *entries {
			if (*entries)[i].originalID == 0 {
				continue
			}
			if source, ok := sources[(*entries)[i].originalID]; ok {
				(*entries)[i].OriginalPost = &source
			}
		}
	}

	countIDs := make([]int64, 0, len(*entries))
	for i := range *entries {
		if (*entries)[i].originalID == 0 && (*entries)[i].Visibility != "private" {
			countIDs = append(countIDs, (*entries)[i].ID)
		}
	}
	if len(countIDs) == 0 {
		return nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT p.repost_of,COUNT(*)::int,COALESCE(MAX(p.id) FILTER (WHERE p.user_id=$2 AND p.repost_kind='quick'),0)
		FROM posts p
		WHERE p.repost_of=ANY($1::bigint[]) AND `+directPostAccessSQL+`
		GROUP BY p.repost_of`, countIDs, viewerID)
	if err != nil {
		return err
	}
	defer rows.Close()
	counts := make(map[int64]struct {
		count int
		mine  int64
	}, len(countIDs))
	for rows.Next() {
		var id int64
		var value struct {
			count int
			mine  int64
		}
		if err := rows.Scan(&id, &value.count, &value.mine); err != nil {
			return err
		}
		counts[id] = value
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i := range *entries {
		if value, ok := counts[(*entries)[i].ID]; ok && (*entries)[i].originalID == 0 {
			(*entries)[i].RepostCount = value.count
			(*entries)[i].MyRepostID = value.mine
		}
	}
	return nil
}

func (s *server) create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allowFeedWrite(w, r, "post", 12, 10*time.Minute) {
		return
	}
	var body struct {
		Content         string                   `json:"content"`
		Visibility      string                   `json:"visibility"`
		Background      string                   `json:"background"`
		Attachments     []mediax.AttachmentInput `json:"attachments"`
		PublishLocation *postLocation            `json:"publishLocation"`
	}
	if err := httpx.DecodeJSON(w, r, &body, 64<<10); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Visibility == "" {
		body.Visibility = "public"
	}
	if body.Visibility == "public" {
		if !validPostLocation(body.PublishLocation, time.Now()) {
			httpx.Error(w, http.StatusBadRequest, publicLocationRequired)
			return
		}
	} else {
		body.PublishLocation = nil
	}
	p, err := s.createPost(r.Context(), claims.UserID, body.Content, body.Visibility, body.Background, body.PublishLocation, body.Attachments)
	if err != nil {
		status := http.StatusInternalServerError
		switch err.(type) {
		case createPostInputError:
			status = http.StatusBadRequest
		case createPostError:
		default:
			err = createPostError("cannot create post")
		}
		httpx.Error(w, status, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
}

func (s *server) deleteStoryObject(ctx context.Context, storageRef string) error {
	storageRef = strings.TrimSpace(storageRef)
	if storageRef == "" {
		return nil
	}
	if s.deleteStoryMedia != nil {
		return s.deleteStoryMedia(ctx, storageRef)
	}
	if s.storage == nil || !s.storage.Configured() {
		return errors.New("story media storage is not configured")
	}
	return s.storage.Delete(ctx, storageRef)
}

func (s *server) enqueueStoryMediaCleanup(ctx context.Context, tx pgx.Tx, storageRef string) error {
	storageRef = strings.TrimSpace(storageRef)
	if storageRef == "" {
		return nil
	}
	if err := lockStoryMediaRef(ctx, tx, storageRef); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO story_media_cleanup(storage_ref)
		SELECT $1
		WHERE NOT EXISTS (SELECT 1 FROM stories WHERE storage_ref=$1)
		ON CONFLICT (storage_ref) DO NOTHING`, storageRef)
	return err
}

func lockStoryMediaRef(ctx context.Context, tx pgx.Tx, storageRef string) error {
	storageRef = strings.TrimSpace(storageRef)
	if storageRef == "" {
		return nil
	}
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "chatnet:story-media:"+storageRef)
	return err
}

func reserveStoryMediaUse(ctx context.Context, tx pgx.Tx, storageRef string) (bool, error) {
	if err := lockStoryMediaRef(ctx, tx, storageRef); err != nil {
		return false, err
	}
	var cleanupPending bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM story_media_cleanup WHERE storage_ref=$1
	)`, storageRef).Scan(&cleanupPending)
	return cleanupPending, err
}

func (s *server) cleanupExpiredStories(ctx context.Context) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		log.Printf("story expiry transaction failed: %v", err)
		return
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `
		SELECT id,COALESCE(storage_ref,'')
		FROM stories
		WHERE expires_at <= NOW() AND highlight_title IS NULL
		ORDER BY id
		LIMIT 100
		FOR UPDATE SKIP LOCKED`)
	if err != nil {
		log.Printf("story expiry scan failed: %v", err)
		return
	}
	items := make([]storyMediaCleanupJob, 0, 100)
	for rows.Next() {
		var item storyMediaCleanupJob
		if err := rows.Scan(&item.id, &item.storageRef); err != nil {
			rows.Close()
			log.Printf("story expiry scan failed: %v", err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		log.Printf("story expiry scan failed: %v", err)
		return
	}
	rows.Close()
	for _, item := range items {
		if _, err := tx.Exec(ctx, `
			DELETE FROM stories
			WHERE id=$1 AND expires_at <= NOW() AND highlight_title IS NULL`, item.id); err != nil {
			log.Printf("story expiry delete failed story=%d: %v", item.id, err)
			return
		}
		if err := s.enqueueStoryMediaCleanup(ctx, tx, item.storageRef); err != nil {
			log.Printf("story media cleanup enqueue failed story=%d: %v", item.id, err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("story expiry transaction commit failed: %v", err)
	}
}

func (s *server) processStoryMediaCleanup(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sweepCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
			s.cleanupExpiredStories(sweepCtx)
			s.sweepStoryMediaCleanup(sweepCtx)
			cancel()
		}
	}
}

func (s *server) claimStoryMediaCleanup(ctx context.Context) []storyMediaCleanupJob {
	if s.deleteStoryMedia == nil && (s.storage == nil || !s.storage.Configured()) {
		return nil
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		log.Printf("story media cleanup claim failed: %v", err)
		return nil
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `
		UPDATE story_media_cleanup
		SET locked_until=NOW()+INTERVAL '5 minutes'
		WHERE id IN (
			SELECT id FROM story_media_cleanup
			WHERE available_at <= NOW()
			  AND completed_at IS NULL
			  AND (locked_until IS NULL OR locked_until < NOW())
			ORDER BY id
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id,storage_ref`, storyMediaCleanupBatch)
	if err != nil {
		log.Printf("story media cleanup claim failed: %v", err)
		return nil
	}
	jobs := make([]storyMediaCleanupJob, 0, storyMediaCleanupBatch)
	for rows.Next() {
		var job storyMediaCleanupJob
		if err := rows.Scan(&job.id, &job.storageRef); err != nil {
			rows.Close()
			log.Printf("story media cleanup claim failed: %v", err)
			return nil
		}
		jobs = append(jobs, job)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		log.Printf("story media cleanup claim failed: %v", err)
		return nil
	}
	rows.Close()
	if err := tx.Commit(ctx); err != nil {
		log.Printf("story media cleanup claim commit failed: %v", err)
		return nil
	}
	return jobs
}

func (s *server) retryStoryMediaCleanup(ctx context.Context, jobID int64, cause error) error {
	_, err := s.db.Exec(ctx, `
		UPDATE story_media_cleanup
		SET attempts=attempts+1, available_at=NOW()+INTERVAL '5 minutes',
		    locked_until=NULL, last_error=$2
		WHERE id=$1`, jobID, cause.Error())
	return err
}

func (s *server) completeStoryMediaCleanup(ctx context.Context, jobID int64) error {
	_, err := s.db.Exec(ctx, `
		UPDATE story_media_cleanup
		SET completed_at=NOW(), locked_until=NULL, last_error=NULL
		WHERE id=$1 AND completed_at IS NULL`, jobID)
	return err
}

func (s *server) purgeCompletedStoryMediaCleanup(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `DELETE FROM story_media_cleanup
		WHERE completed_at IS NOT NULL AND completed_at <= NOW()-($1 * INTERVAL '1 second')`, storyMediaCleanupReuseGuard.Seconds())
	return err
}

func (s *server) sweepStoryMediaCleanup(ctx context.Context) {
	if err := s.purgeCompletedStoryMediaCleanup(ctx); err != nil {
		log.Printf("completed story media cleanup purge failed: %v", err)
		return
	}
	for _, job := range s.claimStoryMediaCleanup(ctx) {
		var referenced bool
		if err := s.db.QueryRow(ctx, `SELECT EXISTS (
			SELECT 1 FROM stories WHERE storage_ref=$1
		)`, job.storageRef).Scan(&referenced); err != nil {
			log.Printf("story media cleanup reference check failed job=%d: %v", job.id, err)
			if updateErr := s.retryStoryMediaCleanup(ctx, job.id, err); updateErr != nil {
				log.Printf("story media cleanup retry update failed job=%d: %v", job.id, updateErr)
			}
			continue
		}
		if referenced {
			if _, err := s.db.Exec(ctx, "DELETE FROM story_media_cleanup WHERE id=$1", job.id); err != nil {
				log.Printf("story media cleanup cancellation failed job=%d: %v", job.id, err)
			}
			continue
		}
		if err := s.deleteStoryObject(ctx, job.storageRef); err != nil {
			log.Printf("story media cleanup failed job=%d: %v", job.id, err)
			if updateErr := s.retryStoryMediaCleanup(ctx, job.id, err); updateErr != nil {
				log.Printf("story media cleanup retry update failed job=%d: %v", job.id, updateErr)
			}
			continue
		}
		if err := s.completeStoryMediaCleanup(ctx, job.id); err != nil {
			log.Printf("story media cleanup completion failed job=%d: %v", job.id, err)
		}
	}
}

func (s *server) listStories(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	s.cleanupExpiredStories(r.Context())
	rows, err := s.db.Query(r.Context(), `
		SELECT s.id,u.username,u.display_name,COALESCE(s.storage_ref,''),COALESCE(s.original_name,''),
		       COALESCE(s.content_type,''),COALESCE(s.size_bytes,0),s.kind,
		       COALESCE(s.text_content,''),COALESCE(s.text_background,''),s.created_at,s.expires_at
		FROM stories s JOIN users u ON u.id=s.user_id
		WHERE s.expires_at > NOW()
		  AND ($2 OR s.kind <> 'text')
		  AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		    (b.blocker_id=$1 AND b.blocked_id=s.user_id) OR (b.blocked_id=$1 AND b.blocker_id=s.user_id))
		ORDER BY (s.user_id=$1) DESC,s.created_at DESC
		LIMIT 100`, claims.UserID, r.URL.Query().Get("includeText") == "true")
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load stories")
		return
	}
	defer rows.Close()

	items := []story{}
	for rows.Next() {
		var item story
		var attachment mediax.Attachment
		if err := rows.Scan(
			&item.ID,
			&item.Author,
			&item.AuthorDisplayName,
			&attachment.StorageRef,
			&attachment.Name,
			&attachment.ContentType,
			&attachment.SizeBytes,
			&attachment.Kind,
			&item.Text,
			&item.Background,
			&item.CreatedAt,
			&item.ExpiresAt,
		); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot load stories")
			return
		}
		if attachment.Kind != "text" {
			mediax.SignAttachment(s.storage, &attachment)
			item.Attachment = &attachment
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load stories")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) createStory(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	// Older PWA bundles may resend signed download URL and attachment ID received
	// from the upload response. Accept only these known legacy response fields,
	// but NEVER trust them: ownership and storage metadata are verified below.
	var body struct {
		Attachment *struct {
			mediax.AttachmentInput
			URL string `json:"url"`
			ID  int64  `json:"id"`
		} `json:"attachment"`
		Text       *string `json:"text"`
		Background *string `json:"background"`
	}
	if err := httpx.DecodeJSON(w, r, &body, 8<<10); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	var item story
	if body.Text != nil && body.Attachment == nil {
		item.Text = strings.TrimSpace(*body.Text)
		if item.Text == "" || utf8.RuneCountInString(item.Text) > storyTextLimit || strings.ContainsRune(item.Text, 0) {
			httpx.Error(w, http.StatusBadRequest, "Story text must contain 1 to 200 characters")
			return
		}
		item.Background = "berry"
		if body.Background != nil {
			item.Background = *body.Background
		}
		switch item.Background {
		case "berry", "indigo", "teal", "sunset":
		default:
			httpx.Error(w, http.StatusBadRequest, "invalid Story background")
			return
		}
	} else if body.Attachment != nil && body.Text == nil && body.Background == nil {
		attachments, err := mediax.ValidateAttachments(
			r.Context(), s.storage, "story", claims.UserID,
			[]mediax.AttachmentInput{body.Attachment.AttachmentInput}, 1,
		)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(attachments) != 1 {
			httpx.Error(w, http.StatusBadRequest, "Story requires one image or video")
			return
		}
		item.Attachment = &attachments[0]
	} else {
		httpx.Error(w, http.StatusBadRequest, "Story requires either text or one image or video")
		return
	}

	if err := s.db.QueryRow(r.Context(), "SELECT username,display_name FROM users WHERE id=$1", claims.UserID).Scan(&item.Author, &item.AuthorDisplayName); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story author")
		return
	}
	var err error
	if a := item.Attachment; a != nil {
		tx, err := s.db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "story service unavailable")
			return
		}
		defer tx.Rollback(r.Context())
		cleanupPending, err := reserveStoryMediaUse(r.Context(), tx, a.StorageRef)
		if err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "story service unavailable")
			return
		}
		if cleanupPending {
			httpx.Error(w, http.StatusBadRequest, "story media reference cannot be reused; upload a new file")
			return
		}
		err = tx.QueryRow(r.Context(), `
			INSERT INTO stories(user_id,storage_ref,original_name,content_type,size_bytes,kind)
			VALUES($1,$2,$3,$4,$5,$6)
			RETURNING id,created_at,expires_at`,
			claims.UserID, a.StorageRef, a.Name, a.ContentType, a.SizeBytes, a.Kind,
		).Scan(&item.ID, &item.CreatedAt, &item.ExpiresAt)
		if err == nil {
			err = tx.Commit(r.Context())
		}
	} else {
		err = s.db.QueryRow(r.Context(), `
			INSERT INTO stories(user_id,kind,text_content,text_background)
			VALUES($1,'text',$2,$3)
			RETURNING id,created_at,expires_at`,
			claims.UserID, item.Text, item.Background,
		).Scan(&item.ID, &item.CreatedAt, &item.ExpiresAt)
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create story")
		return
	}
	httpx.JSON(w, http.StatusCreated, item)
}

func (s *server) deleteStory(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusBadRequest, "invalid story id")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "story service unavailable")
		return
	}
	defer tx.Rollback(r.Context())
	var storageRef string
	err = tx.QueryRow(r.Context(), `
		SELECT COALESCE(storage_ref,'')
		FROM stories WHERE id=$1 AND user_id=$2 FOR UPDATE`, id, claims.UserID).Scan(&storageRef)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "story not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load story")
		return
	}
	tag, err := tx.Exec(r.Context(), `DELETE FROM stories WHERE id=$1 AND user_id=$2`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot delete story")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "story not found")
		return
	}
	if err := s.enqueueStoryMediaCleanup(r.Context(), tx, storageRef); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "story cleanup unavailable")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot delete story")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) like(w http.ResponseWriter, r *http.Request) {
	s.changePostReaction(w, r, "👍")
}

func (s *server) addComment(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allowFeedWrite(w, r, "comment", 30, time.Minute) {
		return
	}
	postID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || postID <= 0 {
		httpx.Error(w, http.StatusBadRequest, "invalid post id")
		return
	}
	var body struct {
		Content  string `json:"content"`
		ParentID *int64 `json:"parentId"`
	}
	if err := httpx.DecodeJSON(w, r, &body, 16<<10); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.Content = strings.TrimSpace(body.Content)
	if body.Content == "" || utf8.RuneCountInString(body.Content) > 1000 || (body.ParentID != nil && *body.ParentID <= 0) {
		httpx.Error(w, http.StatusBadRequest, "content is required and must be <= 1000 characters")
		return
	}

	if !s.canReadPost(r.Context(), postID, claims.UserID) {
		httpx.Error(w, http.StatusNotFound, "post not found")
		return
	}
	tag, err := s.db.Exec(r.Context(), `
		INSERT INTO comments(post_id,user_id,content,parent_id)
		SELECT p.id,$2,$3,$4::bigint
		FROM posts p
		WHERE p.id=$1 AND `+feedAccessSQL+`
		  AND p.repost_kind IS DISTINCT FROM 'quick'
		  AND ($4::bigint IS NULL OR EXISTS (
		    SELECT 1 FROM comments c WHERE c.id=$4 AND c.post_id=p.id
		    AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$2 AND b.blocked_id=c.user_id) OR (b.blocked_id=$2 AND b.blocker_id=c.user_id))
		  ))`, postID, claims.UserID, body.Content, body.ParentID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create comment")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "post or parent comment not found")
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
		SELECT p.id,u.username,u.display_name,p.content,p.likes_count,p.created_at
		FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$1`, postID,
	).Scan(&p.ID, &p.Author, &p.AuthorDisplayName, &p.Content, &p.Likes, &p.CreatedAt)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "post not found")
		return
	}
	s.respondPost(w, r, postID, claims.UserID, http.StatusCreated)
}
