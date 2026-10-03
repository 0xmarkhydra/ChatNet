package main

import (
	"context"
	"encoding/json"
	"fmt"
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
	"chatnet/internal/redisx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type message struct {
	ID                  int64               `json:"id"`
	ConversationID      int64               `json:"conversationId"`
	SenderID            int64               `json:"senderId"`
	Sender              string              `json:"sender"`
	Text                string              `json:"text"`
	ReplyToMessageID    *int64              `json:"replyToMessageId,omitempty"`
	ReplyToSender       string              `json:"replyToSender,omitempty"`
	ReplyToText         string              `json:"replyToText,omitempty"`
	EditedAt            *time.Time          `json:"editedAt,omitempty"`
	Deleted             bool                `json:"deleted,omitempty"`
	Reactions           []messageReaction   `json:"reactions,omitempty"`
	ReadByUserIDs       []int64             `json:"readByUserIds,omitempty"`
	TranslatedText      string              `json:"translatedText,omitempty"`
	TranslationLanguage string              `json:"translationLanguage,omitempty"`
	Attachments         []mediax.Attachment `json:"attachments,omitempty"`
	CreatedAt           time.Time           `json:"createdAt"`
}

type messageReaction struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	Mine  bool   `json:"mine"`
}

type conversation struct {
	ID            int64      `json:"id"`
	Type          string     `json:"type"`
	Name          string     `json:"name"`
	OtherUserID   *int64     `json:"otherUserId,omitempty"`
	MemberCount   int        `json:"memberCount"`
	UnreadCount   int        `json:"unreadCount"`
	LastMessage   string     `json:"lastMessage"`
	LastMessageAt *time.Time `json:"lastMessageAt,omitempty"`
	Online        bool       `json:"online"`
	CreatedAt     time.Time  `json:"createdAt"`
}

type realtimeEvent struct {
	Type              string        `json:"type"`
	ConversationID    int64         `json:"conversationId"`
	Message           *message      `json:"message,omitempty"`
	Conversation      *conversation `json:"conversation,omitempty"`
	ReaderID          int64         `json:"readerId,omitempty"`
	LastReadMessageID int64         `json:"lastReadMessageId,omitempty"`
}

type server struct {
	db        *pgxpool.Pool
	redis     *redis.Client
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

	rdb, err := redisx.Open(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer rdb.Close()

	s := &server{
		db:        db,
		redis:     rdb,
		jwtSecret: config.Env("JWT_SECRET", "dev-secret-change-me"),
		push:      onesignalx.New(config.Env("ONESIGNAL_APP_ID", ""), config.Env("ONESIGNAL_REST_API_KEY", "")),
		storage:   objectstore.NewFromEnv(),
	}
	go s.expireNearby(ctx)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "chat"})
	})
	mux.Handle("GET /api/push/config", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.pushConfig)))
	mux.Handle("POST /api/push/subscription", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.upsertPushSubscription)))
	mux.Handle("DELETE /api/push/subscription", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.deletePushSubscription)))
	mux.Handle("POST /api/push/test", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.testPushNotification)))
	mux.Handle("POST /api/media/presign", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.presignMedia)))
	mux.Handle("GET /api/profile", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.getProfile)))
	mux.Handle("PUT /api/profile/media", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.updateProfileMedia)))
	mux.HandleFunc("GET /api/users/{username}/avatar", func(w http.ResponseWriter, r *http.Request) { s.profileAsset(w, r, "avatar") })
	mux.HandleFunc("GET /api/users/{username}/cover", func(w http.ResponseWriter, r *http.Request) { s.profileAsset(w, r, "cover") })
	mux.Handle("GET /api/users/search", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.searchUsers)))
	mux.Handle("GET /api/users/suggestions", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.suggestUsers)))
	mux.Handle("POST /api/users/nearby", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.findNearby)))
	mux.Handle("DELETE /api/users/nearby", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.stopNearby)))
	mux.Handle("GET /api/friends", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.listFriends)))
	mux.Handle("GET /api/friends/requests", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.listFriendRequests)))
	mux.Handle("POST /api/friends/{id}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.sendFriendRequest)))
	mux.Handle("POST /api/friends/{id}/accept", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.acceptFriendRequest)))
	mux.Handle("DELETE /api/friends/{id}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.removeFriendConnection)))
	mux.Handle("GET /api/preferences/translation", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.getTranslationPreferences)))
	mux.Handle("PUT /api/preferences/translation", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.updateTranslationPreferences)))
	mux.Handle("GET /api/conversations", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.listConversations)))
	mux.Handle("POST /api/conversations/direct", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.createDirect)))
	mux.Handle("POST /api/conversations/groups", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.createGroup)))
	mux.Handle("GET /api/conversations/{id}/messages", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.listMessages)))
	mux.Handle("POST /api/conversations/{id}/messages", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.createMessage)))
	mux.Handle("PATCH /api/messages/{id}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.editMessage)))
	mux.Handle("DELETE /api/messages/{id}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.deleteMessage)))
	mux.Handle("POST /api/messages/{id}/reactions", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.toggleMessageReaction)))
	mux.Handle("POST /api/conversations/{id}/read", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.markRead)))
	mux.Handle("PATCH /api/conversations/{id}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.updateGroup)))
	mux.Handle("GET /api/conversations/{id}/members", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.listGroupMembers)))
	mux.Handle("POST /api/conversations/{id}/members", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.addGroupMembers)))
	mux.Handle("PATCH /api/conversations/{id}/members/{userId}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.updateGroupMemberRole)))
	mux.Handle("DELETE /api/conversations/{id}/members/{userId}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.removeGroupMember)))
	mux.Handle("GET /api/events", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.events)))

	port := config.Env("PORT", "8082")
	log.Printf("chat service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func (s *server) pushConfig(w http.ResponseWriter, r *http.Request) {
	appID := s.push.AppID()
	httpx.JSON(w, http.StatusOK, map[string]any{
		"configured": s.push.Configured(),
		"appId":      appID,
	})
}

func (s *server) presignMedia(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body mediax.UploadRequest
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	ticket, err := mediax.Presign(s.storage, claims.UserID, body)
	if err != nil {
		status := http.StatusBadRequest
		if s.storage == nil || !s.storage.Configured() {
			status = http.StatusServiceUnavailable
		}
		httpx.Error(w, status, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, ticket)
}

func (s *server) upsertPushSubscription(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		SubscriptionID string `json:"subscriptionId"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	id := strings.TrimSpace(body.SubscriptionID)
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "subscriptionId is required")
		return
	}
	_, err := s.db.Exec(r.Context(), `
		INSERT INTO push_subscriptions(subscription_id,user_id,updated_at)
		VALUES($1,$2,NOW())
		ON CONFLICT(subscription_id) DO UPDATE SET
			user_id=EXCLUDED.user_id,
			updated_at=NOW()`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid subscriptionId")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *server) deletePushSubscription(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		SubscriptionID string `json:"subscriptionId"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	id := strings.TrimSpace(body.SubscriptionID)
	if id != "" {
		_, _ = s.db.Exec(r.Context(),
			`DELETE FROM push_subscriptions WHERE subscription_id=$1 AND user_id=$2`,
			id, claims.UserID)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *server) testPushNotification(w http.ResponseWriter, r *http.Request) {
	if !s.push.Configured() {
		httpx.Error(w, http.StatusServiceUnavailable, "push notification is not configured")
		return
	}

	claims, _ := authx.ClaimsFromContext(r.Context())

	rows, err := s.db.Query(r.Context(), `
		SELECT subscription_id::text
		FROM push_subscriptions
		WHERE user_id=$1
		ORDER BY updated_at DESC`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load push subscriptions")
		return
	}
	defer rows.Close()

	subscriptionIDs := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil && id != "" {
			subscriptionIDs = append(subscriptionIDs, id)
		}
	}
	if len(subscriptionIDs) == 0 {
		httpx.Error(w, http.StatusConflict, "no push subscription registered")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	if err := s.push.SendToSubscriptions(ctx, subscriptionIDs, onesignalx.Notification{
		Title: "ChatNet",
		Body:  "🔔 Thông báo ChatNet đang hoạt động.",
		URL:   "https://chat.codelocal.cloud/",
		Data:  map[string]any{"type": "push.test"},
	}); err != nil {
		log.Printf("onesignal test notification failed user=%d: %v", claims.UserID, err)
		httpx.Error(w, http.StatusBadGateway, "cannot send test notification")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"recipients": len(subscriptionIDs),
	})
}

func (s *server) suggestUsers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())

	rows, err := s.db.Query(r.Context(), `
		WITH my_groups AS (
			SELECT cm.conversation_id
			FROM conversation_members cm
			JOIN conversations c ON c.id=cm.conversation_id
			WHERE cm.user_id=$1 AND c.type='group'
		),
		shared_groups AS (
			SELECT cm.user_id, COUNT(*)::int AS mutual_groups
			FROM conversation_members cm
			JOIN my_groups mg ON mg.conversation_id=cm.conversation_id
			WHERE cm.user_id<>$1
			GROUP BY cm.user_id
		),
		direct_contacts AS (
			SELECT other.user_id
			FROM conversations c
			JOIN conversation_members mine
				ON mine.conversation_id=c.id AND mine.user_id=$1
			JOIN conversation_members other
				ON other.conversation_id=c.id AND other.user_id<>$1
			WHERE c.type='direct'
		)
		SELECT u.id,u.username,u.display_name,COALESCE(sg.mutual_groups,0)
		FROM users u
		LEFT JOIN shared_groups sg ON sg.user_id=u.id
		WHERE u.id<>$1
		  AND NOT EXISTS (
			SELECT 1 FROM direct_contacts dc WHERE dc.user_id=u.id
		  )
		ORDER BY COALESCE(sg.mutual_groups,0) DESC, u.created_at DESC
		LIMIT 10`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load friend suggestions")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var username, displayName string
		var mutualGroups int
		if rows.Scan(&id, &username, &displayName, &mutualGroups) != nil {
			continue
		}

		reason := "Gợi ý trên ChatNet"
		if mutualGroups == 1 {
			reason = "1 nhóm chung"
		} else if mutualGroups > 1 {
			reason = fmt.Sprintf("%d nhóm chung", mutualGroups)
		}

		items = append(items, map[string]any{
			"id":           id,
			"username":     username,
			"displayName":  displayName,
			"online":       s.redis.Exists(r.Context(), presenceKey(id)).Val() > 0,
			"mutualGroups": mutualGroups,
			"reason":       reason,
		})
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) searchUsers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	q = strings.TrimPrefix(q, "@")
	if len(q) > 254 {
		httpx.Error(w, http.StatusBadRequest, "search query must be <= 254 bytes")
		return
	}
	if len(q) < 1 {
		httpx.JSON(w, http.StatusOK, []any{})
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT id,username,display_name
		FROM users
		WHERE id<>$1 AND (strpos(lower(username), $2)>0 OR lower(email)=$2)
		ORDER BY username ASC LIMIT 12`, claims.UserID, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot search users")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var username, displayName string
		if rows.Scan(&id, &username, &displayName) == nil {
			items = append(items, map[string]any{
				"id": id, "username": username, "displayName": displayName,
				"online": s.redis.Exists(r.Context(), presenceKey(id)).Val() > 0,
			})
		}
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) getTranslationPreferences(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())

	_, _ = s.db.Exec(r.Context(), `
		INSERT INTO user_preferences(user_id, translation_target, auto_translate)
		VALUES($1, 'en', TRUE)
		ON CONFLICT(user_id) DO NOTHING`, claims.UserID)

	var target string
	var auto bool
	if err := s.db.QueryRow(r.Context(), `
		SELECT translation_target, auto_translate
		FROM user_preferences
		WHERE user_id=$1`, claims.UserID).Scan(&target, &auto); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load translation preferences")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"targetLanguage": target,
		"autoTranslate":  auto,
	})
}

func (s *server) updateTranslationPreferences(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())

	var body struct {
		TargetLanguage string `json:"targetLanguage"`
		AutoTranslate  bool   `json:"autoTranslate"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	target := strings.ToLower(strings.TrimSpace(body.TargetLanguage))
	if !validTranslationTarget(target) {
		httpx.Error(w, http.StatusBadRequest, "unsupported translation language")
		return
	}

	_, err := s.db.Exec(r.Context(), `
		INSERT INTO user_preferences(user_id, translation_target, auto_translate, updated_at)
		VALUES($1,$2,$3,NOW())
		ON CONFLICT(user_id) DO UPDATE SET
			translation_target=EXCLUDED.translation_target,
			auto_translate=EXCLUDED.auto_translate,
			updated_at=NOW()`,
		claims.UserID, target, body.AutoTranslate)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save translation preferences")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"targetLanguage": target,
		"autoTranslate":  body.AutoTranslate,
	})
}

func validTranslationTarget(value string) bool {
	switch value {
	case "en", "vi", "ja", "ko", "zh", "th", "fr", "de", "es":
		return true
	default:
		return false
	}
}

func (s *server) listConversations(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `
		SELECT c.id,c.type,COALESCE(c.name,''),c.created_at,cm.last_read_message_id,
		       COALESCE((SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=c.id),0),
		       COALESCE((
		           SELECT CASE
		               WHEN BTRIM(m.text) <> '' THEN m.text
		               ELSE COALESCE((
		                   SELECT CASE ma.kind
		                       WHEN 'image' THEN '[Ảnh]'
		                       WHEN 'video' THEN '[Video]'
		                       WHEN 'audio' THEN '[Âm thanh]'
		                       ELSE '[Tệp]'
		                   END
		                   FROM message_attachments ma
		                   WHERE ma.message_id=m.id
		                   ORDER BY ma.position,ma.id
		                   LIMIT 1
		               ), '')
		           END
		           FROM messages m
		           WHERE m.conversation_id=c.id
		           ORDER BY m.id DESC
		           LIMIT 1
		       ),''),
		       COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1),c.created_at),
		       COALESCE((SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.id>cm.last_read_message_id AND m.user_id<>$1),0)
		FROM conversations c
		JOIN conversation_members cm ON cm.conversation_id=c.id
		WHERE cm.user_id=$1
		ORDER BY COALESCE((SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id=c.id), c.created_at) DESC`,
		claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load conversations")
		return
	}
	defer rows.Close()

	items := []conversation{}
	for rows.Next() {
		var c conversation
		var lastRead, memberCount, unreadCount int64
		var lastMessageAt time.Time
		if err := rows.Scan(&c.ID, &c.Type, &c.Name, &c.CreatedAt, &lastRead, &memberCount, &c.LastMessage, &lastMessageAt, &unreadCount); err != nil {
			continue
		}
		c.MemberCount = int(memberCount)
		c.UnreadCount = int(unreadCount)
		c.LastMessageAt = &lastMessageAt

		if c.Type == "direct" {
			var otherID int64
			var displayName string
			err := s.db.QueryRow(r.Context(), `
				SELECT u.id,u.username
				FROM conversation_members cm
				JOIN users u ON u.id=cm.user_id
				WHERE cm.conversation_id=$1 AND cm.user_id<>$2 LIMIT 1`,
				c.ID, claims.UserID).Scan(&otherID, &displayName)
			if err == nil {
				c.Name = displayName
				c.OtherUserID = &otherID
				c.Online = s.redis.Exists(r.Context(), presenceKey(otherID)).Val() > 0
			}
		}
		items = append(items, c)
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) createDirect(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Username string `json:"username"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	username := strings.ToLower(strings.TrimSpace(body.Username))
	if username == "" || username == claims.Username {
		httpx.Error(w, http.StatusBadRequest, "invalid username")
		return
	}

	var otherID int64
	var otherName string
	if err := s.db.QueryRow(r.Context(),
		`SELECT id,username FROM users WHERE username=$1`, username,
	).Scan(&otherID, &otherName); err != nil {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}

	ids := []int64{claims.UserID, otherID}
	key := directKey(claims.UserID, otherID)

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create conversation")
		return
	}
	defer tx.Rollback(r.Context())

	var id int64
	var createdAt time.Time
	err = tx.QueryRow(r.Context(), `
		INSERT INTO conversations(type,direct_key,created_by)
		VALUES('direct',$1,$2)
		ON CONFLICT(direct_key) DO UPDATE SET direct_key=EXCLUDED.direct_key
		RETURNING id,created_at`, key, claims.UserID).Scan(&id, &createdAt)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create conversation")
		return
	}

	for _, uid := range ids {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO conversation_members(conversation_id,user_id,role)
			VALUES($1,$2,'member') ON CONFLICT DO NOTHING`, id, uid); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot add member")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save conversation")
		return
	}

	c := conversation{
		ID: id, Type: "direct", Name: otherName, OtherUserID: &otherID,
		MemberCount: 2, CreatedAt: createdAt,
		Online: s.redis.Exists(r.Context(), presenceKey(otherID)).Val() > 0,
	}
	s.publishConversationEvent(r.Context(), ids, realtimeEvent{Type: "conversation.created", ConversationID: id, Conversation: &c})
	httpx.JSON(w, http.StatusCreated, c)
}

func (s *server) createGroup(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Name      string   `json:"name"`
		Usernames []string `json:"usernames"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" || len(name) > 120 {
		httpx.Error(w, http.StatusBadRequest, "group name is required and must be <= 120 characters")
		return
	}

	userIDs, missing := s.resolveGroupMembers(r.Context(), claims.UserID, claims.Username, body.Usernames)
	if len(missing) > 0 {
		httpx.Error(w, http.StatusBadRequest, "users not found: "+strings.Join(missing, ", "))
		return
	}
	if len(userIDs) < 2 {
		httpx.Error(w, http.StatusBadRequest, "group needs at least 2 members")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create group")
		return
	}
	defer tx.Rollback(r.Context())

	var id int64
	var createdAt time.Time
	if err := tx.QueryRow(r.Context(), `
		INSERT INTO conversations(type,name,created_by)
		VALUES('group',$1,$2) RETURNING id,created_at`,
		name, claims.UserID).Scan(&id, &createdAt); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create group")
		return
	}

	for _, uid := range userIDs {
		role := "member"
		if uid == claims.UserID {
			role = "owner"
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO conversation_members(conversation_id,user_id,role)
			VALUES($1,$2,$3)`, id, uid, role); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot add group member")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save group")
		return
	}

	c := conversation{ID: id, Type: "group", Name: name, MemberCount: len(userIDs), CreatedAt: createdAt}
	s.publishConversationEvent(r.Context(), userIDs, realtimeEvent{Type: "conversation.created", ConversationID: id, Conversation: &c})

	recipients := make([]int64, 0, len(userIDs))
	for _, uid := range userIDs {
		if uid != claims.UserID {
			recipients = append(recipients, uid)
		}
	}
	s.sendPushAsync(recipients, onesignalx.Notification{
		Title: "ChatNet",
		Body:  "Bạn vừa được thêm vào một nhóm chat mới.",
		URL:   fmt.Sprintf("https://chat.codelocal.cloud/?conversation=%d", id),
		Data:  map[string]any{"type": "conversation.created", "conversationId": id},
	})

	httpx.JSON(w, http.StatusCreated, c)
}

func (s *server) listMessages(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok || !s.isMember(r.Context(), conversationID, claims.UserID) {
		if ok {
			httpx.Error(w, http.StatusForbidden, "not a conversation member")
		}
		return
	}

	target := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("target")))
	if target != "" && !validTranslationTarget(target) {
		httpx.Error(w, http.StatusBadRequest, "unsupported translation language")
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT m.id,m.conversation_id,m.user_id,u.username,m.text,
		       m.reply_to_message_id,COALESCE(ru.username,''),COALESCE(rm.text,''),
		       m.edited_at,(m.deleted_at IS NOT NULL),
		       ARRAY(
		           SELECT cmr.user_id
		           FROM conversation_members cmr
		           WHERE cmr.conversation_id=m.conversation_id
		             AND cmr.user_id<>m.user_id
		             AND cmr.last_read_message_id>=m.id
		           ORDER BY cmr.user_id
		       ),
		       COALESCE(mt.translated_text,''),COALESCE(mt.target_language,''),m.created_at
		FROM messages m
		JOIN users u ON u.id=m.user_id
		LEFT JOIN messages rm ON rm.id=m.reply_to_message_id
		LEFT JOIN users ru ON ru.id=rm.user_id
		LEFT JOIN message_translations mt
		  ON mt.message_id=m.id AND mt.target_language=$2
		WHERE m.conversation_id=$1
		ORDER BY m.id DESC LIMIT 200`, conversationID, target)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load messages")
		return
	}
	defer rows.Close()

	items := []message{}
	for rows.Next() {
		var m message
		if rows.Scan(
			&m.ID, &m.ConversationID, &m.SenderID, &m.Sender, &m.Text,
			&m.ReplyToMessageID, &m.ReplyToSender, &m.ReplyToText,
			&m.EditedAt, &m.Deleted, &m.ReadByUserIDs,
			&m.TranslatedText, &m.TranslationLanguage, &m.CreatedAt,
		) == nil {
			if m.Deleted {
				m.Text = ""
				m.TranslatedText = ""
			}
			items = append(items, m)
		}
	}
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}
	if err := s.attachMessageMedia(r.Context(), items); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load message attachments")
		return
	}
	if err := s.attachMessageReactions(r.Context(), claims.UserID, items); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load message reactions")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) createMessage(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok || !s.isMember(r.Context(), conversationID, claims.UserID) {
		if ok {
			httpx.Error(w, http.StatusForbidden, "not a conversation member")
		}
		return
	}

	var body struct {
		Text             string                   `json:"text"`
		ReplyToMessageID *int64                   `json:"replyToMessageId"`
		Attachments      []mediax.AttachmentInput `json:"attachments"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.Text = strings.TrimSpace(body.Text)
	if len(body.Text) > 4000 {
		httpx.Error(w, http.StatusBadRequest, "text must be <= 4000 characters")
		return
	}

	attachments, err := mediax.ValidateAttachments(
		r.Context(),
		s.storage,
		"chat",
		claims.UserID,
		body.Attachments,
		mediax.MaxChatAttachments,
	)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.Text == "" && len(attachments) == 0 {
		httpx.Error(w, http.StatusBadRequest, "message text or attachment is required")
		return
	}
	if body.ReplyToMessageID != nil {
		var replyConversationID int64
		if err := s.db.QueryRow(r.Context(), `
			SELECT conversation_id FROM messages WHERE id=$1
		`, *body.ReplyToMessageID).Scan(&replyConversationID); err != nil || replyConversationID != conversationID {
			httpx.Error(w, http.StatusBadRequest, "invalid reply message")
			return
		}
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create message")
		return
	}
	defer tx.Rollback(r.Context())

	m := message{
		ConversationID:   conversationID,
		SenderID:         claims.UserID,
		Sender:           claims.Username,
		ReplyToMessageID: body.ReplyToMessageID,
		Attachments:      attachments,
		Reactions:        []messageReaction{},
	}
	if err := tx.QueryRow(r.Context(), `
		INSERT INTO messages(conversation_id,user_id,text,reply_to_message_id)
		VALUES($1,$2,$3,$4) RETURNING id,text,created_at`,
		conversationID, claims.UserID, body.Text, body.ReplyToMessageID,
	).Scan(&m.ID, &m.Text, &m.CreatedAt); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create message")
		return
	}

	for position, attachment := range attachments {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO message_attachments(
				message_id,storage_ref,original_name,content_type,size_bytes,kind,position
			) VALUES($1,$2,$3,$4,$5,$6,$7)`,
			m.ID,
			attachment.StorageRef,
			attachment.Name,
			attachment.ContentType,
			attachment.SizeBytes,
			attachment.Kind,
			position,
		); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot save message attachment")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save message")
		return
	}
	if m.ReplyToMessageID != nil {
		_ = s.db.QueryRow(r.Context(), `
			SELECT u.username, CASE WHEN rm.deleted_at IS NULL THEN rm.text ELSE '' END
			FROM messages rm
			JOIN users u ON u.id=rm.user_id
			WHERE rm.id=$1
		`, *m.ReplyToMessageID).Scan(&m.ReplyToSender, &m.ReplyToText)
	}

	memberIDs := s.memberIDs(r.Context(), conversationID)
	s.publishConversationEvent(r.Context(), memberIDs, realtimeEvent{Type: "message", ConversationID: conversationID, Message: &m})

	recipients := make([]int64, 0, len(memberIDs))
	for _, uid := range memberIDs {
		if uid != claims.UserID {
			recipients = append(recipients, uid)
		}
	}
	notificationBody := "Bạn có một tin nhắn mới."
	if body.Text == "" && len(attachments) > 0 {
		notificationBody = "Bạn nhận được " + mediax.PreviewLabel(attachments[0].Kind) + "."
	}
	s.sendPushAsync(recipients, onesignalx.Notification{
		Title: "ChatNet",
		Body:  notificationBody,
		URL:   fmt.Sprintf("https://chat.codelocal.cloud/?conversation=%d", conversationID),
		Data:  map[string]any{"type": "message", "conversationId": conversationID, "messageId": m.ID},
	})

	httpx.JSON(w, http.StatusCreated, m)
}

func (s *server) loadMessage(ctx context.Context, messageID, viewerID int64) (message, error) {
	var m message
	err := s.db.QueryRow(ctx, `
		SELECT m.id,m.conversation_id,m.user_id,u.username,m.text,
		       m.reply_to_message_id,COALESCE(ru.username,''),COALESCE(rm.text,''),
		       m.edited_at,(m.deleted_at IS NOT NULL),
		       ARRAY(
		           SELECT cmr.user_id
		           FROM conversation_members cmr
		           WHERE cmr.conversation_id=m.conversation_id
		             AND cmr.user_id<>m.user_id
		             AND cmr.last_read_message_id>=m.id
		           ORDER BY cmr.user_id
		       ),
		       m.created_at
		FROM messages m
		JOIN users u ON u.id=m.user_id
		LEFT JOIN messages rm ON rm.id=m.reply_to_message_id
		LEFT JOIN users ru ON ru.id=rm.user_id
		WHERE m.id=$1`, messageID).Scan(
		&m.ID, &m.ConversationID, &m.SenderID, &m.Sender, &m.Text,
		&m.ReplyToMessageID, &m.ReplyToSender, &m.ReplyToText,
		&m.EditedAt, &m.Deleted, &m.ReadByUserIDs, &m.CreatedAt,
	)
	if err != nil {
		return message{}, err
	}
	if m.Deleted {
		m.Text = ""
	}
	items := []message{m}
	if err := s.attachMessageMedia(ctx, items); err != nil {
		return message{}, err
	}
	if err := s.attachMessageReactions(ctx, viewerID, items); err != nil {
		return message{}, err
	}
	return items[0], nil
}

func (s *server) editMessage(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	messageID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}

	var body struct {
		Text string `json:"text"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.Text = strings.TrimSpace(body.Text)
	if body.Text == "" || len(body.Text) > 4000 {
		httpx.Error(w, http.StatusBadRequest, "text must be between 1 and 4000 characters")
		return
	}

	var conversationID int64
	if err := s.db.QueryRow(r.Context(), `
		UPDATE messages
		SET text=$1,edited_at=NOW()
		WHERE id=$2 AND user_id=$3 AND deleted_at IS NULL
		RETURNING conversation_id`, body.Text, messageID, claims.UserID).Scan(&conversationID); err != nil {
		httpx.Error(w, http.StatusNotFound, "message not found or cannot be edited")
		return
	}
	_, _ = s.db.Exec(r.Context(), `DELETE FROM message_translations WHERE message_id=$1`, messageID)

	m, err := s.loadMessage(r.Context(), messageID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load edited message")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
		Type: "message.updated", ConversationID: conversationID, Message: &m,
	})
	httpx.JSON(w, http.StatusOK, m)
}

func (s *server) deleteMessage(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	messageID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}

	var conversationID int64
	if err := s.db.QueryRow(r.Context(), `
		UPDATE messages
		SET text='',deleted_at=NOW(),edited_at=NULL
		WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
		RETURNING conversation_id`, messageID, claims.UserID).Scan(&conversationID); err != nil {
		httpx.Error(w, http.StatusNotFound, "message not found or cannot be recalled")
		return
	}
	_, _ = s.db.Exec(r.Context(), `DELETE FROM message_attachments WHERE message_id=$1`, messageID)
	_, _ = s.db.Exec(r.Context(), `DELETE FROM message_translations WHERE message_id=$1`, messageID)

	m, err := s.loadMessage(r.Context(), messageID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load recalled message")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
		Type: "message.updated", ConversationID: conversationID, Message: &m,
	})
	httpx.JSON(w, http.StatusOK, m)
}

func (s *server) toggleMessageReaction(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	messageID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}

	var body struct {
		Emoji string `json:"emoji"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	allowed := map[string]bool{
		"👍": true, "❤️": true, "😂": true, "😮": true, "😢": true, "🙏": true,
	}
	if !allowed[body.Emoji] {
		httpx.Error(w, http.StatusBadRequest, "unsupported reaction")
		return
	}

	var conversationID int64
	if err := s.db.QueryRow(r.Context(), `
		SELECT conversation_id FROM messages WHERE id=$1 AND deleted_at IS NULL
	`, messageID).Scan(&conversationID); err != nil {
		httpx.Error(w, http.StatusNotFound, "message not found")
		return
	}
	if !s.isMember(r.Context(), conversationID, claims.UserID) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}

	var exists bool
	_ = s.db.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM message_reactions
			WHERE message_id=$1 AND user_id=$2 AND emoji=$3
		)`, messageID, claims.UserID, body.Emoji).Scan(&exists)

	if exists {
		if _, err := s.db.Exec(r.Context(), `
			DELETE FROM message_reactions
			WHERE message_id=$1 AND user_id=$2 AND emoji=$3
		`, messageID, claims.UserID, body.Emoji); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot remove reaction")
			return
		}
	} else {
		if _, err := s.db.Exec(r.Context(), `
			INSERT INTO message_reactions(message_id,user_id,emoji)
			VALUES($1,$2,$3)
			ON CONFLICT DO NOTHING
		`, messageID, claims.UserID, body.Emoji); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot save reaction")
			return
		}
	}

	m, err := s.loadMessage(r.Context(), messageID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load reaction")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
		Type: "message.updated", ConversationID: conversationID, Message: &m,
	})
	httpx.JSON(w, http.StatusOK, m)
}

func (s *server) attachMessageMedia(ctx context.Context, items []message) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(items))
	indexByID := make(map[int64]int, len(items))
	for i := range items {
		ids = append(ids, items[i].ID)
		indexByID[items[i].ID] = i
		items[i].Attachments = []mediax.Attachment{}
	}

	rows, err := s.db.Query(ctx, `
		SELECT id,message_id,storage_ref,original_name,content_type,size_bytes,kind
		FROM message_attachments
		WHERE message_id = ANY($1::bigint[])
		ORDER BY message_id,position,id`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var messageID int64
		var attachment mediax.Attachment
		if err := rows.Scan(
			&attachment.ID,
			&messageID,
			&attachment.StorageRef,
			&attachment.Name,
			&attachment.ContentType,
			&attachment.SizeBytes,
			&attachment.Kind,
		); err != nil {
			return err
		}
		mediax.SignAttachment(s.storage, &attachment)
		if idx, ok := indexByID[messageID]; ok {
			items[idx].Attachments = append(items[idx].Attachments, attachment)
		}
	}
	return rows.Err()
}

func (s *server) attachMessageReactions(ctx context.Context, viewerID int64, items []message) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(items))
	indexByID := make(map[int64]int, len(items))
	for i := range items {
		ids = append(ids, items[i].ID)
		indexByID[items[i].ID] = i
		items[i].Reactions = []messageReaction{}
	}

	rows, err := s.db.Query(ctx, `
		SELECT message_id,emoji,COUNT(*)::int,BOOL_OR(user_id=$2)
		FROM message_reactions
		WHERE message_id = ANY($1::bigint[])
		GROUP BY message_id,emoji
		ORDER BY message_id,MIN(created_at)
	`, ids, viewerID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var messageID int64
		var reaction messageReaction
		if err := rows.Scan(&messageID, &reaction.Emoji, &reaction.Count, &reaction.Mine); err != nil {
			return err
		}
		if idx, ok := indexByID[messageID]; ok {
			items[idx].Reactions = append(items[idx].Reactions, reaction)
		}
	}
	return rows.Err()
}

func (s *server) markRead(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}

	var previousReadID int64
	if err := s.db.QueryRow(r.Context(), `
		SELECT last_read_message_id
		FROM conversation_members
		WHERE conversation_id=$1 AND user_id=$2
	`, conversationID, claims.UserID).Scan(&previousReadID); err != nil {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}

	var maxID int64
	_ = s.db.QueryRow(r.Context(), `
		SELECT COALESCE(MAX(id),0)
		FROM messages
		WHERE conversation_id=$1
	`, conversationID).Scan(&maxID)

	if maxID > previousReadID {
		if _, err := s.db.Exec(r.Context(), `
			UPDATE conversation_members
			SET last_read_message_id=$1
			WHERE conversation_id=$2 AND user_id=$3
		`, maxID, conversationID, claims.UserID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot update read state")
			return
		}
		s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
			Type:              "conversation.read",
			ConversationID:    conversationID,
			ReaderID:          claims.UserID,
			LastReadMessageID: maxID,
		})
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"conversationId":    conversationID,
		"lastReadMessageId": maxID,
	})
}

func (s *server) events(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	key := presenceKey(claims.UserID)
	_ = s.redis.Set(r.Context(), key, "1", 45*time.Second).Err()
	pubsub := s.redis.Subscribe(r.Context(), userChannel(claims.UserID))
	defer pubsub.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	ch := pubsub.Channel()
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case item, open := <-ch:
			if !open {
				return
			}
			fmt.Fprintf(w, "event: update\ndata: %s\n\n", item.Payload)
			flusher.Flush()
		case <-ticker.C:
			_ = s.redis.Expire(r.Context(), key, 45*time.Second).Err()
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

func (s *server) resolveGroupMembers(ctx context.Context, ownerID int64, ownerUsername string, usernames []string) ([]int64, []string) {
	userIDs := []int64{ownerID}
	seen := map[int64]bool{ownerID: true}
	missing := []string{}

	for _, raw := range usernames {
		username := strings.ToLower(strings.TrimSpace(raw))
		if username == "" || username == ownerUsername {
			continue
		}
		var id int64
		if err := s.db.QueryRow(ctx, `SELECT id FROM users WHERE username=$1`, username).Scan(&id); err != nil {
			missing = append(missing, username)
			continue
		}
		if !seen[id] {
			seen[id] = true
			userIDs = append(userIDs, id)
		}
	}
	return userIDs, missing
}

func (s *server) sendPushAsync(userIDs []int64, notification onesignalx.Notification) {
	if !s.push.Configured() || len(userIDs) == 0 {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		rows, err := s.db.Query(ctx, `
			SELECT subscription_id::text
			FROM push_subscriptions
			WHERE user_id = ANY($1::bigint[])
			ORDER BY updated_at DESC`, userIDs)
		if err != nil {
			log.Printf("load push subscriptions failed: %v", err)
			return
		}
		defer rows.Close()

		subscriptionIDs := []string{}
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil && id != "" {
				subscriptionIDs = append(subscriptionIDs, id)
			}
		}
		if len(subscriptionIDs) == 0 {
			return
		}

		if err := s.push.SendToSubscriptions(ctx, subscriptionIDs, notification); err != nil {
			log.Printf("onesignal notification failed: %v", err)
		}
	}()
}

func directKey(a, b int64) string {
	if a > b {
		a, b = b, a
	}
	return fmt.Sprintf("%d:%d", a, b)
}

func (s *server) isMember(ctx context.Context, conversationID, userID int64) bool {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2
		)`, conversationID, userID).Scan(&exists)
	return err == nil && exists
}

func (s *server) memberIDs(ctx context.Context, conversationID int64) []int64 {
	rows, err := s.db.Query(ctx, `SELECT user_id FROM conversation_members WHERE conversation_id=$1`, conversationID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	ids := []int64{}
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func (s *server) publishConversationEvent(ctx context.Context, userIDs []int64, event realtimeEvent) {
	data, _ := json.Marshal(event)
	for _, userID := range userIDs {
		_ = s.redis.Publish(ctx, userChannel(userID), data).Err()
	}
}

func userChannel(userID int64) string {
	return fmt.Sprintf("chatnet:user:%d", userID)
}

func presenceKey(userID int64) string {
	return fmt.Sprintf("chatnet:presence:%d", userID)
}

func parseID(w http.ResponseWriter, raw string) (int64, bool) {
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return 0, false
	}
	return id, true
}
