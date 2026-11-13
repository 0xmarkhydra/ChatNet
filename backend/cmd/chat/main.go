package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
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
	"chatnet/internal/languagecatalog"
	"chatnet/internal/mediax"
	"chatnet/internal/objectstore"
	"chatnet/internal/onesignalx"
	"chatnet/internal/redisx"
	"chatnet/internal/searchx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type message struct {
	ID                  int64               `json:"id"`
	ClientID            string              `json:"clientId,omitempty"`
	ConversationID      int64               `json:"conversationId"`
	ChannelID           int64               `json:"channelId,omitempty"`
	SenderID            int64               `json:"senderId"`
	Sender              string              `json:"sender"`
	SenderDisplayName   string              `json:"senderDisplayName,omitempty"`
	Text                string              `json:"text"`
	Forwarded           bool                `json:"forwarded,omitempty"`
	ReplyToMessageID    *int64              `json:"replyToMessageId,omitempty"`
	ReplyToSender       string              `json:"replyToSender,omitempty"`
	ReplyToDisplayName  string              `json:"replyToDisplayName,omitempty"`
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
	BlockedByMe    bool       `json:"blockedByMe,omitempty"`
	BlockedByOther bool       `json:"blockedByOther,omitempty"`
	CategoryID     *int64     `json:"categoryId,omitempty"`
	PinnedAt       *time.Time `json:"pinnedAt,omitempty"`
	ID             int64      `json:"id"`
	Type           string     `json:"type"`
	Name           string     `json:"name"`
	OtherUserID    *int64     `json:"otherUserId,omitempty"`
	OtherUsername  string     `json:"otherUsername,omitempty"`
	MemberCount    int        `json:"memberCount"`
	UnreadCount    int        `json:"unreadCount"`
	LastMessage    string     `json:"lastMessage"`
	LastMessageAt  *time.Time `json:"lastMessageAt,omitempty"`
	AvatarURL      string     `json:"avatarUrl,omitempty"`
	AvatarMembers  []string   `json:"avatarMembers,omitempty"`
	Online         bool       `json:"online"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type realtimeEvent struct {
	CategoryID        *int64        `json:"categoryId,omitempty"`
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
	if err := database.Migrate(ctx, db); err != nil {
		log.Fatalf("chat schema migration: %v", err)
	}

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
	go s.cleanupOrphanChatMedia(ctx)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "chat"})
	})
	mux.Handle("GET /api/push/config", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.pushConfig)))
	mux.Handle("POST /api/push/subscription", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.upsertPushSubscription)))
	mux.Handle("DELETE /api/push/subscription", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deletePushSubscription)))
	mux.Handle("POST /api/push/test", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.testPushNotification)))
	mux.Handle("POST /api/media/presign", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.presignMedia)))
	mux.Handle("PUT /api/media/relay", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.relayMediaUpload)))
	mux.HandleFunc("GET /api/media/chat/{id}", s.serveChatMedia)
	mux.Handle("GET /api/users/{username}/profile", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getUserProfile)))
	mux.Handle("GET /api/profile/note", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getProfileNote)))
	mux.Handle("POST /api/profile/note", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.saveProfileNote)))
	mux.Handle("DELETE /api/profile/note", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deleteProfileNote)))
	mux.Handle("GET /api/users/{username}/note", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getProfileNote)))
	mux.Handle("GET /api/profile", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getProfile)))
	mux.Handle("PUT /api/profile", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateProfile)))
	mux.Handle("PUT /api/profile/media", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateProfileMedia)))
	mux.HandleFunc("GET /api/users/{username}/avatar", func(w http.ResponseWriter, r *http.Request) { s.profileAsset(w, r, "avatar") })
	mux.HandleFunc("GET /api/users/{username}/cover", func(w http.ResponseWriter, r *http.Request) { s.profileAsset(w, r, "cover") })
	mux.Handle("GET /api/users/search", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.searchUsers)))
	mux.Handle("GET /api/users/suggestions", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.suggestUsers)))
	mux.Handle("POST /api/users/nearby", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.findNearby)))
	mux.Handle("DELETE /api/users/nearby", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.stopNearby)))
	mux.Handle("GET /api/friends", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listFriends)))
	mux.Handle("GET /api/contacts", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listContactMetadata)))
	mux.Handle("PUT /api/contacts/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateContactMetadata)))
	mux.Handle("GET /api/friends/requests", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listFriendRequests)))
	mux.Handle("POST /api/friends/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.sendFriendRequest)))
	mux.Handle("POST /api/friends/{id}/accept", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.acceptFriendRequest)))
	mux.Handle("DELETE /api/friends/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.removeFriendConnection)))
	mux.Handle("GET /api/privacy", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getPrivacy)))
	mux.Handle("PUT /api/privacy", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updatePrivacy)))
	mux.Handle("GET /api/users/blocked", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listBlockedUsers)))
	mux.Handle("POST /api/users/{id}/block", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.blockUser)))
	mux.Handle("DELETE /api/users/{id}/block", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.unblockUser)))
	mux.Handle("POST /api/users/{id}/report", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.reportUser)))
	mux.Handle("GET /api/preferences", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getPreferences)))
	mux.Handle("PUT /api/preferences", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updatePreferences)))
	mux.Handle("GET /api/preferences/translation", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getTranslationPreferences)))
	mux.Handle("PUT /api/preferences/translation", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateTranslationPreferences)))
	mux.Handle("GET /api/conversation-categories", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listCategories)))
	mux.Handle("POST /api/conversation-categories", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.saveCategory)))
	mux.Handle("PUT /api/conversation-categories/{categoryId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.saveCategory)))
	mux.Handle("DELETE /api/conversation-categories/{categoryId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deleteCategory)))
	mux.Handle("PUT /api/conversations/{id}/category", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.assignCategory)))
	mux.Handle("GET /api/link-preview", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getLinkPreview)))
	mux.Handle("GET /api/conversations", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listConversations)))
	mux.Handle("PUT /api/conversations/{id}/pin", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.setConversationPin)))
	mux.Handle("DELETE /api/conversations/{id}/pin", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.setConversationPin)))
	mux.Handle("GET /api/conversations/{id}/pins", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listPinnedMessages)))
	mux.Handle("GET /api/chat/search", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.quickChatSearch)))
	mux.Handle("GET /api/conversations/unread", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.unreadSummary)))
	mux.Handle("GET /api/conversations/memberships", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listConversationMemberships)))
	mux.Handle("POST /api/conversations/direct", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createDirect)))
	mux.Handle("POST /api/conversations/groups", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createGroup)))
	mux.Handle("GET /api/groups/public", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listPublicCommunities)))
	mux.Handle("POST /api/groups/{id}/join", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.joinPublicCommunity)))
	mux.Handle("GET /api/conversations/{id}/community", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getCommunityProfile)))
	mux.Handle("PATCH /api/conversations/{id}/community", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.patchCommunityProfile)))
	mux.Handle("GET /api/conversations/{id}/notification-settings", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getGroupNotificationPreferences)))
	mux.Handle("PUT /api/conversations/{id}/notification-settings", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.putGroupNotificationPreferences)))
	mux.Handle("GET /api/conversations/{id}/avatar", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.groupAvatarCapability)))
	mux.Handle("PUT /api/conversations/{id}/avatar", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateGroupAvatar)))
	mux.Handle("GET /api/conversations/{id}/channels", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listGroupChannels)))
	mux.Handle("POST /api/conversations/{id}/channel-read", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.markGroupChannelRead)))
	mux.Handle("POST /api/conversations/{id}/channels", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createGroupChannel)))
	mux.Handle("PATCH /api/conversations/{id}/channels/{channelId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateGroupChannel)))
	mux.Handle("DELETE /api/conversations/{id}/channels/{channelId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deleteGroupChannel)))
	mux.Handle("GET /api/conversations/{id}/activities", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listGroupActivities)))
	mux.Handle("POST /api/conversations/{id}/activities", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createGroupActivity)))
	mux.Handle("POST /api/conversations/{id}/activities/{activityId}/vote", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.voteGroupActivity)))
	mux.Handle("PUT /api/conversations/{id}/activities/{activityId}/pin", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.setGroupActivityPin)))
	mux.Handle("DELETE /api/conversations/{id}/activities/{activityId}/pin", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.setGroupActivityPin)))
	mux.Handle("GET /api/conversations/{id}/messages", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listMessages)))
	mux.Handle("DELETE /api/conversations/{id}/history", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.clearConversationHistory)))
	mux.Handle("GET /api/conversations/{id}/shared", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listSharedContent)))
	mux.Handle("POST /api/conversations/{id}/messages", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createMessage)))
	mux.Handle("PATCH /api/messages/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.editMessage)))
	mux.Handle("DELETE /api/messages/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.deleteMessage)))
	mux.Handle("POST /api/messages/{id}/reactions", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.toggleMessageReaction)))
	mux.Handle("GET /api/messages/{id}/reactions", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listMessageReactionUsers)))
	mux.Handle("PUT /api/messages/{id}/pin", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.setMessagePin)))
	mux.Handle("DELETE /api/messages/{id}/pin", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.setMessagePin)))
	mux.Handle("POST /api/conversations/{id}/read", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.markRead)))
	mux.Handle("PATCH /api/conversations/{id}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateGroup)))
	mux.Handle("GET /api/conversations/{id}/members", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listGroupMembers)))
	mux.Handle("POST /api/conversations/{id}/members", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.addGroupMembers)))
	mux.Handle("PATCH /api/conversations/{id}/members/{userId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.updateGroupMemberRole)))
	mux.Handle("DELETE /api/conversations/{id}/members/{userId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.removeGroupMember)))
	mux.Handle("GET /api/conversations/{id}/group-settings", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.getGroupSettings)))
	mux.Handle("PATCH /api/conversations/{id}/group-settings", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.patchGroupSettings)))
	mux.Handle("POST /api/conversations/{id}/invites", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.createGroupInvite)))
	mux.Handle("GET /api/conversations/{id}/invites", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listGroupInvites)))
	mux.Handle("DELETE /api/conversations/{id}/invites/{inviteId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.revokeGroupInvite)))
	mux.Handle("GET /api/group-invites/{token}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.previewGroupInvite)))
	mux.Handle("POST /api/group-invites/{token}/join", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.joinGroupInvite)))
	mux.Handle("GET /api/conversations/{id}/join-requests", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listGroupJoinRequests)))
	mux.Handle("POST /api/conversations/{id}/join-requests/{requestId}", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.reviewGroupJoinRequest)))
	mux.Handle("GET /api/conversations/{id}/admin-audit", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.listGroupAudit)))
	mux.Handle("GET /api/events", authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, http.HandlerFunc(s.events)))

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
	ticket.RelayToken = s.mediaRelayToken(claims.UserID, ticket.StorageRef, body.SizeBytes, body.ContentType, ticket.ExpiresAt)
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
		SELECT u.id,u.username,u.display_name,u.show_online_status,COALESCE(sg.mutual_groups,0)
		FROM users u
		LEFT JOIN shared_groups sg ON sg.user_id=u.id
		WHERE u.id<>$1
		  AND (u.searchable_by_username OR u.searchable_by_name)
		  AND NOT EXISTS (
		    SELECT 1 FROM user_blocks b
		    WHERE (b.blocker_id=$1 AND b.blocked_id=u.id)
		       OR (b.blocker_id=u.id AND b.blocked_id=$1)
		  )
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
		var showOnline bool
		var mutualGroups int
		if rows.Scan(&id, &username, &displayName, &showOnline, &mutualGroups) != nil {
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
			"online":       showOnline && s.redis.Exists(r.Context(), presenceKey(id)).Val() > 0,
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
		SELECT id,username,display_name,show_online_status
		FROM users
		WHERE id<>$1
		  AND NOT EXISTS (
		    SELECT 1 FROM user_blocks b
		    WHERE (b.blocker_id=$1 AND b.blocked_id=users.id)
		       OR (b.blocker_id=users.id AND b.blocked_id=$1)
		  )
		  AND (
			(searchable_by_username AND strpos(`+searchx.FoldSQL("username")+`, `+searchx.FoldSQL("$2")+`)>0)
			OR (searchable_by_email AND lower(email)=$2)
			OR (searchable_by_name AND strpos(`+searchx.FoldSQL("display_name")+`, `+searchx.FoldSQL("$2")+`)>0)
		  )
		ORDER BY
		  CASE
			WHEN searchable_by_username AND lower(username)=$2 THEN 0
			WHEN searchable_by_email AND lower(email)=$2 THEN 1
			WHEN searchable_by_username AND strpos(`+searchx.FoldSQL("username")+`, `+searchx.FoldSQL("$2")+`)=1 THEN 2
			WHEN searchable_by_username AND strpos(`+searchx.FoldSQL("username")+`, `+searchx.FoldSQL("$2")+`)>0 THEN 3
			WHEN searchable_by_name AND strpos(`+searchx.FoldSQL("display_name")+`, `+searchx.FoldSQL("$2")+`)=1 THEN 4
			ELSE 5
		  END,
		  username ASC
		LIMIT 20`, claims.UserID, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot search users")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var username, displayName string
		var showOnline bool
		if rows.Scan(&id, &username, &displayName, &showOnline) == nil {
			items = append(items, map[string]any{
				"id": id, "username": username, "displayName": displayName,
				"online": showOnline && s.redis.Exists(r.Context(), presenceKey(id)).Val() > 0,
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
	return languagecatalog.Valid(value)
}

func (s *server) listConversations(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	// Optional exact lookup reuses the same membership/privacy projection as the list.
	conversationID := int64(0)
	if raw := r.URL.Query().Get("id"); raw != "" {
		var err error
		conversationID, err = strconv.ParseInt(raw, 10, 64)
		if err != nil || conversationID <= 0 {
			httpx.Error(w, http.StatusBadRequest, "invalid conversation id")
			return
		}
	}
	limit := 2147483647 // Preserve the original unpaginated response for older app versions.
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 100 {
			httpx.Error(w, http.StatusBadRequest, "invalid limit (1-100)")
			return
		}
		limit = n
	}
	offset := 0
	if raw := r.URL.Query().Get("offset"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 || n > 1000000 {
			httpx.Error(w, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = n
	}
	keyword := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(keyword)) > 120 {
		httpx.Error(w, http.StatusBadRequest, "search query too long")
		return
	}
	categoryID := int64(-1)
	if raw := r.URL.Query().Get("category"); raw != "" {
		var err error
		categoryID, err = strconv.ParseInt(raw, 10, 64)
		if err != nil || categoryID < 0 {
			httpx.Error(w, 400, "invalid category")
			return
		}
	}
	unreadOnly := false
	if raw := r.URL.Query().Get("unread"); raw != "" {
		var err error
		unreadOnly, err = strconv.ParseBool(raw)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid unread filter")
			return
		}
	}
	conversationType := r.URL.Query().Get("type")
	if conversationType != "" && conversationType != "direct" && conversationType != "group" {
		httpx.Error(w, http.StatusBadRequest, "invalid conversation type")
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT ca.category_id,c.id,c.type,COALESCE(c.name,''),c.created_at,cm.last_read_message_id,cm.pinned_at,
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
		           WHERE m.conversation_id=c.id AND m.id>cm.cleared_through_message_id AND
		             (c.type='direct' OR NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		               (b.blocker_id=$1 AND b.blocked_id=m.user_id) OR (b.blocked_id=$1 AND b.blocker_id=m.user_id)))
		           ORDER BY m.id DESC
		           LIMIT 1
		       ),''),
		       COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id AND m.id>cm.cleared_through_message_id AND
		         (c.type='direct' OR NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		           (b.blocker_id=$1 AND b.blocked_id=m.user_id) OR (b.blocked_id=$1 AND b.blocker_id=m.user_id))) ORDER BY m.id DESC LIMIT 1),c.created_at),
		       COALESCE((SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id
             AND m.id>CASE WHEN c.type='group' THEN COALESCE((
               SELECT gcr.last_read_message_id FROM group_channel_reads gcr
               WHERE gcr.conversation_id=c.id AND gcr.user_id=$1 AND gcr.channel_id=COALESCE(m.channel_id,0)
             ),cm.last_read_message_id) ELSE cm.last_read_message_id END
             AND m.id>cm.cleared_through_message_id AND m.user_id<>$1 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		         (b.blocker_id=$1 AND b.blocked_id=m.user_id) OR (b.blocked_id=$1 AND b.blocker_id=m.user_id))),0), COALESCE(c.group_avatar_ref,''),
		       CASE WHEN c.type='group' THEN ARRAY(
		           SELECT u.username
		           FROM conversation_members avatar_member
		           JOIN users u ON u.id=avatar_member.user_id
		           WHERE avatar_member.conversation_id=c.id
		           ORDER BY CASE WHEN avatar_member.user_id=$1 THEN 1 ELSE 0 END, avatar_member.user_id
		           LIMIT 3
		       ) ELSE ARRAY[]::text[] END
		FROM conversations c
		JOIN conversation_members cm ON cm.conversation_id=c.id
		LEFT JOIN conversation_category_assignments ca ON ca.conversation_id=c.id AND ca.user_id=$1
        WHERE cm.user_id=$1
          AND ($5::bigint=0 OR c.id=$5)
          AND ($4::bigint=-1 OR ($4=0 AND ca.category_id IS NULL) OR ca.category_id=$4)
		  AND ($8::text='' OR c.type=$8)
		  AND ($7::boolean=FALSE OR EXISTS (
		    SELECT 1 FROM messages unread
		    WHERE unread.conversation_id=c.id
              AND unread.id>CASE WHEN c.type='group' THEN COALESCE((
                SELECT gcr.last_read_message_id FROM group_channel_reads gcr
                WHERE gcr.conversation_id=c.id AND gcr.user_id=$1 AND gcr.channel_id=COALESCE(unread.channel_id,0)
              ),cm.last_read_message_id) ELSE cm.last_read_message_id END
              AND unread.id>cm.cleared_through_message_id AND unread.user_id<>$1
		      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		        (b.blocker_id=$1 AND b.blocked_id=unread.user_id) OR (b.blocked_id=$1 AND b.blocker_id=unread.user_id))
		  ))
		  AND ($6::text='' OR strpos(`+searchx.FoldSQL("COALESCE(c.name,'')")+`, `+searchx.FoldSQL("$6")+`)>0
		    OR EXISTS (SELECT 1 FROM conversation_members other
		       JOIN users u ON u.id=other.user_id
		       LEFT JOIN friend_contact_metadata meta ON meta.owner_id=$1 AND meta.contact_id=other.user_id
		       WHERE other.conversation_id=c.id AND other.user_id<>$1
		         AND (strpos(`+searchx.FoldSQL("u.username")+`, `+searchx.FoldSQL("$6")+`)>0 OR strpos(`+searchx.FoldSQL("u.display_name")+`, `+searchx.FoldSQL("$6")+`)>0 OR strpos(`+searchx.FoldSQL("meta.nickname")+`, `+searchx.FoldSQL("$6")+`)>0))
		    OR EXISTS (SELECT 1 FROM messages msg WHERE msg.conversation_id=c.id AND msg.id>cm.cleared_through_message_id
		       AND msg.deleted_at IS NULL AND strpos(`+searchx.FoldSQL("msg.text")+`, `+searchx.FoldSQL("$6")+`)>0
		       AND (c.type='direct' OR NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
		         (b.blocker_id=$1 AND b.blocked_id=msg.user_id) OR (b.blocked_id=$1 AND b.blocker_id=msg.user_id)))))
		ORDER BY (cm.pinned_at IS NOT NULL) DESC,cm.pinned_at DESC,COALESCE((SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id=c.id AND m.id>cm.cleared_through_message_id AND
		         (c.type='direct' OR NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		           (b.blocker_id=$1 AND b.blocked_id=m.user_id) OR (b.blocked_id=$1 AND b.blocker_id=m.user_id)))), c.created_at) DESC, c.id DESC
		LIMIT $2 OFFSET $3`,
		claims.UserID, limit, offset, categoryID, conversationID, keyword, unreadOnly, conversationType)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load conversations")
		return
	}
	defer rows.Close()

	items := []conversation{}
	for rows.Next() {
		var c conversation
		var lastRead, memberCount, unreadCount int64
		var groupAvatarRef string
		var lastMessageAt time.Time
		if err := rows.Scan(&c.CategoryID, &c.ID, &c.Type, &c.Name, &c.CreatedAt, &lastRead, &c.PinnedAt, &memberCount, &c.LastMessage, &lastMessageAt, &unreadCount, &groupAvatarRef, &c.AvatarMembers); err != nil {
			continue
		}
		c.MemberCount = int(memberCount)
		c.UnreadCount = int(unreadCount)
		c.LastMessageAt = &lastMessageAt
		if c.Type == "group" && groupAvatarRef != "" && s.storage != nil && s.storage.Configured() {
			c.AvatarURL, _ = s.storage.SignedGetURL(groupAvatarRef, time.Hour)
		}

		if c.Type == "direct" {
			var otherID int64
			var username, displayName string
			var showOnline bool
			err := s.db.QueryRow(r.Context(), `
				SELECT u.id,u.username,COALESCE(NULLIF(BTRIM(u.display_name),''),u.username),u.show_online_status,
				       EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=$2 AND b.blocked_id=u.id),
				       EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=u.id AND b.blocked_id=$2)
				FROM conversation_members cm
				JOIN users u ON u.id=cm.user_id
				WHERE cm.conversation_id=$1 AND cm.user_id<>$2 LIMIT 1`,
				c.ID, claims.UserID).Scan(&otherID, &username, &displayName, &showOnline, &c.BlockedByMe, &c.BlockedByOther)
			if err == nil {
				c.Name = displayName
				c.OtherUsername = username
				c.OtherUserID = &otherID
				c.Online = !c.BlockedByMe && !c.BlockedByOther && showOnline && s.redis.Exists(r.Context(), presenceKey(otherID)).Val() > 0
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
	var otherName, otherUsername string
	var showOnline bool
	if err := s.db.QueryRow(r.Context(),
		`SELECT id,username,COALESCE(NULLIF(BTRIM(display_name),''),username),show_online_status FROM users WHERE username=$1`, username,
	).Scan(&otherID, &otherUsername, &otherName, &showOnline); err != nil {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}
	blocked, err := s.blockedPair(r.Context(), claims.UserID, otherID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify contact policy")
		return
	}
	if blocked {
		httpx.Error(w, http.StatusForbidden, "direct contact is blocked")
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
		ID: id, Type: "direct", Name: otherName, OtherUserID: &otherID, OtherUsername: otherUsername,
		MemberCount: 2, CreatedAt: createdAt,
		Online: showOnline && s.redis.Exists(r.Context(), presenceKey(otherID)).Val() > 0,
	}
	s.publishConversationEvent(r.Context(), ids, realtimeEvent{Type: "conversation.created", ConversationID: id, Conversation: &c})
	httpx.JSON(w, http.StatusCreated, c)
}

func (s *server) createGroup(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Name        string   `json:"name"`
		Usernames   []string `json:"usernames"`
		Description string   `json:"description"`
		Topic       string   `json:"topic"`
		Rules       string   `json:"rules"`
		Visibility  string   `json:"visibility"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" || len(name) > 120 {
		httpx.Error(w, http.StatusBadRequest, "group name is required and must be <= 120 characters")
		return
	}
	if body.Visibility == "" {
		body.Visibility = "private"
	}
	if !validCommunityFields(communityFields{body.Description, body.Topic, body.Rules, body.Visibility}) {
		httpx.Error(w, http.StatusBadRequest, "invalid community fields")
		return
	}
	if len(body.Usernames) > 50 {
		httpx.Error(w, 400, "maximum 50 invited members")
		return
	}

	userIDs, missing := s.resolveGroupMembers(r.Context(), claims.UserID, claims.Username, body.Usernames)
	if len(missing) > 0 {
		httpx.Error(w, http.StatusBadRequest, "users not found: "+strings.Join(missing, ", "))
		return
	}
	if len(userIDs) < 1 {
		httpx.Error(w, http.StatusBadRequest, "group owner is required")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create group")
		return
	}
	defer tx.Rollback(r.Context())

	// Direct group creation can include only the creator's accepted friends.
	// Validate before creating the group, preventing partial membership writes.
	for _, candidateID := range userIDs {
		if candidateID == claims.UserID {
			continue
		}
		allowed, err := groupMemberInvitationEligible(r.Context(), tx, claims.UserID, candidateID)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot verify friendship")
			return
		}
		if !allowed {
			httpx.Error(w, http.StatusForbidden, "chỉ có thể tạo nhóm với bạn bè đã kết bạn")
			return
		}
	}

	var id int64
	var createdAt time.Time
	if err := tx.QueryRow(r.Context(), `
		INSERT INTO conversations(type,name,created_by,group_description,group_topic,group_rules,group_visibility)
		VALUES('group',$1,$2,$3,$4,$5,$6) RETURNING id,created_at`,
		name, claims.UserID, strings.TrimSpace(body.Description), strings.TrimSpace(body.Topic), strings.TrimSpace(body.Rules), body.Visibility).Scan(&id, &createdAt); err != nil {
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

func searchDateBounds(fromDate, toDate *time.Time, offsetMinutes int) (from, to time.Time) {
	offset := time.Duration(offsetMinutes) * time.Minute
	if fromDate != nil {
		from = fromDate.Add(offset)
	}
	if toDate != nil {
		to = toDate.AddDate(0, 0, 1).Add(offset)
	}
	return
}

func nullableSearchTime(source *time.Time, value time.Time) *time.Time {
	if source == nil {
		return nil
	}
	return &value
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
	// Existing participants may read their chat history after a block.
	// Mutations and media downloads still enforce the block policy.
	channelID := int64(0)
	if raw := r.URL.Query().Get("channelId"); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || value < 0 {
			httpx.Error(w, 400, "invalid channel id")
			return
		}
		channelID = value
	}
	if channelID > 0 && !s.groupChannelExists(r.Context(), conversationID, channelID) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	target := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("target")))
	if target != "" && !validTranslationTarget(target) {
		httpx.Error(w, http.StatusBadRequest, "unsupported translation language")
		return
	}
	limit := 200
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 200 {
			httpx.Error(w, http.StatusBadRequest, "invalid limit (1-200)")
			return
		}
		limit = n
	}
	var before int64
	if raw := r.URL.Query().Get("before"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || n < 1 {
			httpx.Error(w, http.StatusBadRequest, "invalid before cursor")
			return
		}
		before = n
	}

	keyword := strings.TrimSpace(r.URL.Query().Get("search"))
	sender := strings.TrimSpace(r.URL.Query().Get("sender"))
	if len([]rune(keyword)) > 200 || len([]rune(sender)) > 100 {
		httpx.Error(w, http.StatusBadRequest, "search filter too long")
		return
	}
	var fromDate, toDate *time.Time
	for _, filter := range []struct {
		raw    string
		output **time.Time
	}{
		{r.URL.Query().Get("from"), &fromDate},
		{r.URL.Query().Get("to"), &toDate},
	} {
		if filter.raw == "" {
			continue
		}
		parsed, err := time.Parse("2006-01-02", filter.raw)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid date filter (YYYY-MM-DD)")
			return
		}
		*filter.output = &parsed
	}
	if fromDate != nil && toDate != nil && fromDate.After(*toDate) {
		httpx.Error(w, http.StatusBadRequest, "invalid date range")
		return
	}
	// Browser date inputs represent days in the viewer's local timezone.
	// JavaScript getTimezoneOffset() is UTC minus local time in minutes.
	var tzOffset int
	if raw := r.URL.Query().Get("tzOffset"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < -840 || value > 840 {
			httpx.Error(w, http.StatusBadRequest, "invalid timezone offset")
			return
		}
		tzOffset = value
	}
	from, to := searchDateBounds(fromDate, toDate, tzOffset)

	rows, err := s.db.Query(r.Context(), `
		SELECT m.id,m.conversation_id,COALESCE(m.channel_id,0),m.user_id,u.username,u.display_name,COALESCE(m.client_id,''),m.text,
		       CASE WHEN rm.id IS NULL THEN NULL ELSE m.reply_to_message_id END,COALESCE(ru.username,''),COALESCE(ru.display_name,''),COALESCE(rm.text,''),
		       m.forwarded,m.edited_at,(m.deleted_at IS NOT NULL),
		       ARRAY(
		           SELECT cmr.user_id
		           FROM conversation_members cmr
		           WHERE cmr.conversation_id=m.conversation_id
		             AND cmr.user_id<>m.user_id
		             AND cmr.last_read_message_id>=m.id
		             AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		               (b.blocker_id=$5 AND b.blocked_id=cmr.user_id) OR (b.blocked_id=$5 AND b.blocker_id=cmr.user_id))
		           ORDER BY cmr.user_id
		       ),
		       COALESCE(mt.translated_text,''),COALESCE(mt.target_language,''),m.created_at
		FROM messages m
		JOIN users u ON u.id=m.user_id
		JOIN conversation_members viewer ON viewer.conversation_id=m.conversation_id AND viewer.user_id=$5
		LEFT JOIN messages rm ON rm.id=m.reply_to_message_id AND rm.id>viewer.cleared_through_message_id
		  AND (EXISTS(SELECT 1 FROM conversations rc WHERE rc.id=m.conversation_id AND rc.type='direct')
		    OR NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$5 AND b.blocked_id=rm.user_id) OR (b.blocked_id=$5 AND b.blocker_id=rm.user_id)))
		LEFT JOIN users ru ON ru.id=rm.user_id
		LEFT JOIN message_translations mt
		  ON mt.message_id=m.id AND mt.target_language=$2
		WHERE m.conversation_id=$1 AND m.id>viewer.cleared_through_message_id AND COALESCE(m.channel_id,0)=$10 AND ($3::bigint=0 OR m.id<$3)
		  AND (EXISTS(SELECT 1 FROM conversations dc WHERE dc.id=m.conversation_id AND dc.type='direct')
		    OR NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$5 AND b.blocked_id=m.user_id) OR (b.blocked_id=$5 AND b.blocker_id=m.user_id)))
		  AND ($6::text='' OR (m.deleted_at IS NULL AND strpos(`+searchx.FoldSQL("m.text")+`, `+searchx.FoldSQL("$6")+`)>0))
		  AND ($7::text='' OR lower(u.username)=lower($7))
		  AND ($8::timestamptz IS NULL OR m.created_at >= $8)
		  AND ($9::timestamptz IS NULL OR m.created_at < $9)
		ORDER BY m.id DESC LIMIT $4`, conversationID, target, before, limit, claims.UserID, keyword, sender, nullableSearchTime(fromDate, from), nullableSearchTime(toDate, to), channelID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load messages")
		return
	}
	defer rows.Close()

	items := []message{}
	for rows.Next() {
		var m message
		if rows.Scan(
			&m.ID, &m.ConversationID, &m.ChannelID, &m.SenderID, &m.Sender, &m.SenderDisplayName, &m.ClientID, &m.Text,
			&m.ReplyToMessageID, &m.ReplyToSender, &m.ReplyToDisplayName, &m.ReplyToText,
			&m.Forwarded, &m.EditedAt, &m.Deleted, &m.ReadByUserIDs,
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
	if err := s.attachMessageMedia(r.Context(), items, claims.UserID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load message attachments")
		return
	}
	if err := s.attachMessageReactions(r.Context(), claims.UserID, items); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load message reactions")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func validClientID(id string) bool {
	return len(id) <= 64 && strings.IndexFunc(id, func(c rune) bool {
		return !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-')
	}) < 0
}

// messageRequestFingerprint is computed from the *original* validated request,
// not the mutable message row. An edit/recall cannot turn a valid retry into 409.
func messageRequestFingerprint(conversationID int64, text string, replyTo *int64, attachments []mediax.AttachmentInput, channelIDs ...int64) string {
	refs := make([]string, 0, len(attachments))
	for _, attachment := range attachments {
		refs = append(refs, strings.TrimSpace(attachment.StorageRef))
	}
	var channelID int64
	if len(channelIDs) > 0 {
		channelID = channelIDs[0]
	}
	payload, _ := json.Marshal(struct {
		ConversationID int64    `json:"conversationId"`
		Text           string   `json:"text"`
		ReplyTo        *int64   `json:"replyTo"`
		StorageRefs    []string `json:"storageRefs"`
		ChannelID      int64    `json:"channelId,omitempty"`
	}{conversationID, text, replyTo, refs, channelID})
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:])
}

// The forwarded flag is part of the immutable request identity. Keep the
// original signature for callers validating ordinary chat messages.
func sameMessageRequest(m message, conversationID int64, text string, replyTo *int64, attachments []mediax.AttachmentInput, channelIDs ...int64) bool {
	var channelID int64
	if len(channelIDs) > 0 {
		channelID = channelIDs[0]
	}
	if m.ChannelID != channelID {
		return false
	}
	if m.ConversationID != conversationID || m.Text != text || len(m.Attachments) != len(attachments) {
		return false
	}
	if (m.ReplyToMessageID == nil) != (replyTo == nil) {
		return false
	}
	if replyTo != nil && *m.ReplyToMessageID != *replyTo {
		return false
	}
	for i, item := range attachments {
		if m.Attachments[i].StorageRef != strings.TrimSpace(item.StorageRef) {
			return false
		}
	}
	return true
}

func sameMessageRequestForwarded(m message, conversationID int64, text string, replyTo *int64, attachments []mediax.AttachmentInput, forwarded bool, channelID int64) bool {
	return m.Forwarded == forwarded && sameMessageRequest(m, conversationID, text, replyTo, attachments, channelID)
}

// Preserve the existing SHA-256 digest for ordinary sends and retries.
func messageRequestFingerprintForwarded(conversationID int64, text string, replyTo *int64, attachments []mediax.AttachmentInput, forwarded bool, channelID int64) string {
	base := messageRequestFingerprint(conversationID, text, replyTo, attachments, channelID)
	if !forwarded {
		return base
	}
	digest := sha256.Sum256([]byte("forwarded:" + base))
	return hex.EncodeToString(digest[:])
}

// replyExistingMessage returns true once it wrote a response for an existing client ID.
func (s *server) replyExistingMessage(w http.ResponseWriter, r *http.Request, senderID, conversationID int64, clientID, text string, replyTo *int64, attachments []mediax.AttachmentInput, forwarded bool, channelIDs ...int64) bool {
	var channelID int64
	if len(channelIDs) > 0 {
		channelID = channelIDs[0]
	}
	var messageID int64
	var fingerprint *string
	err := s.db.QueryRow(r.Context(), `
		SELECT id,request_fingerprint FROM messages WHERE user_id=$1 AND client_id=$2
	`, senderID, clientID).Scan(&messageID, &fingerprint)
	if errors.Is(err, pgx.ErrNoRows) {
		return false
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot look up message retry")
		return true
	}
	m, err := s.loadMessage(r.Context(), messageID, senderID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load message retry")
		return true
	}
	if fingerprint != nil {
		if *fingerprint != messageRequestFingerprintForwarded(conversationID, text, replyTo, attachments, forwarded, channelID) {
			httpx.Error(w, http.StatusConflict, "client id was already used for another message")
			return true
		}
	} else if !sameMessageRequestForwarded(m, conversationID, text, replyTo, attachments, forwarded, channelID) {
		// Compatibility for rows created before the additive fingerprint migration.
		httpx.Error(w, http.StatusConflict, "client id was already used for another message")
		return true
	}
	httpx.JSON(w, http.StatusOK, m)
	return true
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
	if !s.allowDirectConversation(w, r, conversationID, claims.UserID) {
		return
	}

	var body struct {
		Text             string                   `json:"text"`
		ClientID         string                   `json:"clientId"`
		ReplyToMessageID *int64                   `json:"replyToMessageId"`
		Forwarded        bool                     `json:"forwarded"`
		ChannelID        int64                    `json:"channelId"`
		Attachments      []mediax.AttachmentInput `json:"attachments"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.Text = strings.TrimSpace(body.Text)
	if body.ChannelID < 0 || (body.ChannelID > 0 && !s.groupChannelExists(r.Context(), conversationID, body.ChannelID)) {
		httpx.Error(w, 404, "channel not found")
		return
	}
	if !validClientID(body.ClientID) {
		httpx.Error(w, http.StatusBadRequest, "invalid client id")
		return
	}
	if len(body.Text) > 4000 {
		httpx.Error(w, http.StatusBadRequest, "text must be <= 4000 characters")
		return
	}
	if body.ClientID != "" && s.replyExistingMessage(w, r, claims.UserID, conversationID, body.ClientID, body.Text, body.ReplyToMessageID, body.Attachments, body.Forwarded, body.ChannelID) {
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
			SELECT m.conversation_id FROM messages m WHERE m.id=$1 AND COALESCE(m.channel_id,0)=$3 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
			  (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR (b.blocked_id=$2 AND b.blocker_id=m.user_id))
		`, *body.ReplyToMessageID, claims.UserID, body.ChannelID).Scan(&replyConversationID); err != nil || replyConversationID != conversationID {
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

	// Lock active membership until the message commits. A group removal cannot
	// race a slow S3 validation and leave a message sent after removal.
	var membership int64
	if err := tx.QueryRow(r.Context(), `
		SELECT conversation_id FROM conversation_members
		WHERE conversation_id=$1 AND user_id=$2 FOR SHARE
	`, conversationID, claims.UserID).Scan(&membership); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusForbidden, "not a conversation member")
		} else {
			httpx.Error(w, http.StatusInternalServerError, "cannot verify conversation membership")
		}
		return
	}

	m := message{
		ClientID:         body.ClientID,
		ConversationID:   conversationID,
		ChannelID:        body.ChannelID,
		SenderID:         claims.UserID,
		Sender:           claims.Username,
		ReplyToMessageID: body.ReplyToMessageID,
		Forwarded:        body.Forwarded,
		Attachments:      attachments,
		Reactions:        []messageReaction{},
	}
	fingerprint := ""
	if body.ClientID != "" {
		fingerprint = messageRequestFingerprintForwarded(conversationID, body.Text, body.ReplyToMessageID, body.Attachments, body.Forwarded, body.ChannelID)
	}
	if err := tx.QueryRow(r.Context(), "SELECT username,display_name FROM users WHERE id=$1", claims.UserID).Scan(&m.Sender, &m.SenderDisplayName); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load message sender")
		return
	}

	err = tx.QueryRow(r.Context(), `
		INSERT INTO messages(conversation_id,user_id,text,reply_to_message_id,client_id,request_fingerprint,channel_id,forwarded)
		VALUES($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,0),$8)
		ON CONFLICT (user_id,client_id) WHERE client_id IS NOT NULL DO NOTHING
		RETURNING id,text,created_at`,
		conversationID, claims.UserID, body.Text, body.ReplyToMessageID, body.ClientID, fingerprint, body.ChannelID, body.Forwarded,
	).Scan(&m.ID, &m.Text, &m.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = tx.Rollback(r.Context())
		if !s.replyExistingMessage(w, r, claims.UserID, conversationID, body.ClientID, body.Text, body.ReplyToMessageID, body.Attachments, body.Forwarded, body.ChannelID) {
			httpx.Error(w, http.StatusConflict, "message retry could not be resolved")
		}
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create message")
		return
	}

	for position, attachment := range attachments {
		var savedID int64
		if err := tx.QueryRow(r.Context(), `
			INSERT INTO message_attachments(
				message_id,storage_ref,original_name,content_type,size_bytes,kind,position
			) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
			m.ID,
			attachment.StorageRef,
			attachment.Name,
			attachment.ContentType,
			attachment.SizeBytes,
			attachment.Kind,
			position,
		).Scan(&savedID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot save message attachment")
			return
		}
		m.Attachments[position].ID = savedID
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save message")
		return
	}
	if m.ReplyToMessageID != nil {
		_ = s.db.QueryRow(r.Context(), `
			SELECT u.username,u.display_name, CASE WHEN rm.deleted_at IS NULL THEN rm.text ELSE '' END
			FROM messages rm
			JOIN users u ON u.id=rm.user_id
			WHERE rm.id=$1
		`, *m.ReplyToMessageID).Scan(&m.ReplyToSender, &m.ReplyToDisplayName, &m.ReplyToText)
	}

	memberIDs := s.memberIDs(r.Context(), conversationID)
	visibleIDs, visibilityErr := s.visibleRecipients(r.Context(), claims.UserID, memberIDs)
	if visibilityErr != nil {
		log.Printf("cannot filter message recipients: %v", visibilityErr)
		visibleIDs = []int64{claims.UserID} // Message persisted; never notify blocked peers on failure.
	}
	s.signChatAttachments(&m, claims.UserID)
	s.publishConversationEvent(r.Context(), visibleIDs, realtimeEvent{Type: "message", ConversationID: conversationID, Message: &m})

	recipients := make([]int64, 0, len(visibleIDs))
	for _, uid := range visibleIDs {
		if uid != claims.UserID {
			recipients = append(recipients, uid)
		}
	}
	recipients = s.groupPushRecipients(r.Context(), conversationID, recipients, body.Text)
	notificationBody := "Bạn có một tin nhắn mới."
	if body.Text == "" && len(attachments) > 0 {
		notificationBody = "Bạn nhận được " + mediax.PreviewLabel(attachments[0].Kind) + "."
	}
	s.sendPushAsync(recipients, onesignalx.Notification{
		Title: "ChatNet",
		Body:  notificationBody,
		URL:   fmt.Sprintf("https://chat.codelocal.cloud/?conversation=%d&message=%d", conversationID, m.ID),
		Data:  map[string]any{"type": "message", "conversationId": conversationID, "messageId": m.ID},
	})

	httpx.JSON(w, http.StatusCreated, m)
}

func (s *server) loadMessage(ctx context.Context, messageID, viewerID int64) (message, error) {
	var m message
	err := s.db.QueryRow(ctx, `
		SELECT m.id,m.conversation_id,COALESCE(m.channel_id,0),m.user_id,u.username,u.display_name,COALESCE(m.client_id,''),m.text,
		       CASE WHEN rm.id IS NULL THEN NULL ELSE m.reply_to_message_id END,COALESCE(ru.username,''),COALESCE(ru.display_name,''),COALESCE(rm.text,''),
		       m.forwarded,m.edited_at,(m.deleted_at IS NOT NULL),
		       ARRAY(
		           SELECT cmr.user_id
		           FROM conversation_members cmr
		           WHERE cmr.conversation_id=m.conversation_id
		             AND cmr.user_id<>m.user_id
		             AND cmr.last_read_message_id>=m.id
		             AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		               (b.blocker_id=$2 AND b.blocked_id=cmr.user_id) OR (b.blocked_id=$2 AND b.blocker_id=cmr.user_id))
		           ORDER BY cmr.user_id
		       ),
		       m.created_at
		FROM messages m
		JOIN users u ON u.id=m.user_id
		LEFT JOIN messages rm ON rm.id=m.reply_to_message_id AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		  (b.blocker_id=$2 AND b.blocked_id=rm.user_id) OR (b.blocked_id=$2 AND b.blocker_id=rm.user_id))
		LEFT JOIN users ru ON ru.id=rm.user_id
		WHERE m.id=$1 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		  (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR (b.blocked_id=$2 AND b.blocker_id=m.user_id))`, messageID, viewerID).Scan(
		&m.ID, &m.ConversationID, &m.ChannelID, &m.SenderID, &m.Sender, &m.SenderDisplayName, &m.ClientID, &m.Text,
		&m.ReplyToMessageID, &m.ReplyToSender, &m.ReplyToDisplayName, &m.ReplyToText,
		&m.Forwarded, &m.EditedAt, &m.Deleted, &m.ReadByUserIDs, &m.CreatedAt,
	)
	if err != nil {
		return message{}, err
	}
	if m.Deleted {
		m.Text = ""
	}
	items := []message{m}
	if err := s.attachMessageMedia(ctx, items, viewerID); err != nil {
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
		UPDATE messages m
		SET text=$1,edited_at=NOW()
		WHERE m.id=$2 AND m.user_id=$3 AND m.deleted_at IS NULL
		  AND EXISTS (
			SELECT 1 FROM conversation_members cm
			WHERE cm.conversation_id=m.conversation_id AND cm.user_id=$3
			FOR SHARE
		  )
		RETURNING m.conversation_id`, body.Text, messageID, claims.UserID).Scan(&conversationID); err != nil {
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
		UPDATE messages m
		SET text='',deleted_at=NOW(),edited_at=NULL
		WHERE m.id=$1 AND m.user_id=$2 AND m.deleted_at IS NULL
		  AND EXISTS (
			SELECT 1 FROM conversation_members cm
			WHERE cm.conversation_id=m.conversation_id AND cm.user_id=$2
			FOR SHARE
		  )
		RETURNING m.conversation_id`, messageID, claims.UserID).Scan(&conversationID); err != nil {
		httpx.Error(w, http.StatusNotFound, "message not found or cannot be recalled")
		return
	}
	_, _ = s.db.Exec(r.Context(), `DELETE FROM message_pins WHERE message_id=$1`, messageID)
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
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
		Type: "pins.updated", ConversationID: conversationID,
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
		"👍": true, "❤️": true, "😂": true, "😮": true, "😢": true, "😡": true,
		"🙏": true, // Legacy reaction remains removable on existing messages.
	}
	if !allowed[body.Emoji] {
		httpx.Error(w, http.StatusBadRequest, "unsupported reaction")
		return
	}

	var conversationID int64
	if err := s.db.QueryRow(r.Context(), `
		SELECT m.conversation_id FROM messages m WHERE m.id=$1 AND m.deleted_at IS NULL
		  AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		    (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR (b.blocked_id=$2 AND b.blocker_id=m.user_id))
	`, messageID, claims.UserID).Scan(&conversationID); err != nil {
		httpx.Error(w, http.StatusNotFound, "message not found")
		return
	}
	if !s.isMember(r.Context(), conversationID, claims.UserID) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}

	if !s.allowDirectConversation(w, r, conversationID, claims.UserID) {
		return
	}

	// Serialize changes to the same message, including requests from multiple tabs.
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot update reaction")
		return
	}
	defer tx.Rollback(r.Context())

	var lockedID int64
	if err := tx.QueryRow(r.Context(), `
		SELECT id FROM messages WHERE id=$1 AND deleted_at IS NULL FOR UPDATE
	`, messageID).Scan(&lockedID); err != nil {
		httpx.Error(w, http.StatusNotFound, "message not found")
		return
	}
	var previous string
	err = tx.QueryRow(r.Context(), `
		SELECT emoji FROM message_reactions
		WHERE message_id=$1 AND user_id=$2 ORDER BY created_at DESC, emoji DESC LIMIT 1
	`, messageID, claims.UserID).Scan(&previous)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusInternalServerError, "cannot read reaction")
		return
	}
	// Also works before the one-per-user index is installed, during a rolling deploy.
	if _, err := tx.Exec(r.Context(), `
		DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2
	`, messageID, claims.UserID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot update reaction")
		return
	}
	if previous != body.Emoji {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO message_reactions(message_id,user_id,emoji) VALUES($1,$2,$3)
		`, messageID, claims.UserID, body.Emoji); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot save reaction")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save reaction")
		return
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

func (s *server) attachMessageMedia(ctx context.Context, items []message, viewerID int64) error {
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
		attachment.URL = s.mediaTicket(attachment.ID, viewerID)
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
		  AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		    (b.blocker_id=$2 AND b.blocked_id=message_reactions.user_id) OR
		    (b.blocked_id=$2 AND b.blocker_id=message_reactions.user_id))
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

	if !s.allowDirectConversation(w, r, conversationID, claims.UserID) {
		return
	}

	var maxID int64
	if err := s.db.QueryRow(r.Context(), `
		SELECT COALESCE(MAX(m.id),0)
		FROM messages m
		WHERE m.conversation_id=$1 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		  (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR
		  (b.blocked_id=$2 AND b.blocker_id=m.user_id))
	`, conversationID, claims.UserID).Scan(&maxID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify read policy")
		return
	}

	lastReadID := previousReadID
	if maxID > previousReadID {
		if err := s.db.QueryRow(r.Context(), `
			UPDATE conversation_members
			SET last_read_message_id=GREATEST(last_read_message_id,$1)
			WHERE conversation_id=$2 AND user_id=$3
			RETURNING last_read_message_id
		`, maxID, conversationID, claims.UserID).Scan(&lastReadID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot update read state")
			return
		}
		s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
			Type:              "conversation.read",
			ConversationID:    conversationID,
			ReaderID:          claims.UserID,
			LastReadMessageID: lastReadID,
		})
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"conversationId":    conversationID,
		"lastReadMessageId": lastReadID,
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
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	lastPing := time.Now()

	for {
		select {
		case <-r.Context().Done():
			return
		case item, open := <-ch:
			if !open {
				return
			}
			if item.Payload == authx.SessionRevocationSignal {
				active, err := authx.SessionActiveCached(r.Context(), s.db, s.redis, claims)
				if err != nil {
					return
				}
				if !active {
					fmt.Fprint(w, "event: session-revoked\ndata: {}\n\n")
					flusher.Flush()
					return
				}
				continue
			}
			var event realtimeEvent
			if json.Unmarshal([]byte(item.Payload), &event) != nil {
				continue
			}
			actorID := int64(0)
			if event.Message != nil {
				actorID = event.Message.SenderID
			}
			if event.Type == "conversation.read" {
				actorID = event.ReaderID
			}
			if actorID > 0 && actorID != claims.UserID {
				blocked, err := s.blockedPair(r.Context(), claims.UserID, actorID)
				if err != nil || blocked {
					continue
				} // Also cover in-flight messages after a block.
			}
			if event.Type == "pins.updated" && !s.isMember(r.Context(), event.ConversationID, claims.UserID) {
				continue
			}
			// Reload in the recipient's privacy scope. C replying to B
			// must not expose B's quoted text or reaction identities to A.
			payload := item.Payload
			if event.Message != nil {
				if !s.isMember(r.Context(), event.ConversationID, claims.UserID) {
					continue
				}
				personalized, err := s.loadMessage(r.Context(), event.Message.ID, claims.UserID)
				if err != nil {
					continue
				}
				event.Message = &personalized
				filtered, err := json.Marshal(event)
				if err != nil {
					continue
				}
				payload = string(filtered)
			}
			fmt.Fprintf(w, "event: update\ndata: %s\n\n", payload)
			flusher.Flush()
		case <-ticker.C:
			active, err := authx.SessionActiveCached(r.Context(), s.db, s.redis, claims)
			if err != nil {
				return // Stream is closed on database outage; never treat it as a revocation.
			}
			if !active {
				fmt.Fprint(w, "event: session-revoked\ndata: {}\n\n")
				flusher.Flush()
				return
			}
			if time.Since(lastPing) >= 20*time.Second {
				_ = s.redis.Expire(r.Context(), key, 45*time.Second).Err()
				fmt.Fprint(w, ": ping\n\n")
				flusher.Flush()
				lastPing = time.Now()
			}
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
	actorID := int64(0)
	if event.Message != nil {
		actorID = event.Message.SenderID
	}
	if event.Type == "conversation.read" {
		actorID = event.ReaderID
	}
	if actorID > 0 {
		visible, err := s.visibleRecipients(ctx, actorID, userIDs)
		if err != nil {
			log.Printf("cannot filter chat event recipients: %v", err)
			return // Fail closed: never broadcast blocked message payloads.
		}
		userIDs = visible
	}
	for _, userID := range userIDs {
		outgoing := event
		if event.Type == "message.updated" && event.Message != nil {
			// "mine" and blocked-user counts depend on the recipient.
			personalized, err := s.loadMessage(ctx, event.Message.ID, userID)
			if err != nil {
				log.Printf("cannot personalize message update for recipient: %v", err)
				continue
			}
			outgoing.Message = &personalized
		}
		if outgoing.Message != nil {
			// Each recipient receives a distinct, revocable media capability.
			copyMessage := *outgoing.Message
			copyMessage.Attachments = append([]mediax.Attachment(nil), outgoing.Message.Attachments...)
			s.signChatAttachments(&copyMessage, userID)
			outgoing.Message = &copyMessage
		}
		data, err := json.Marshal(outgoing)
		if err != nil {
			continue
		}
		_ = s.redis.Publish(ctx, userChannel(userID), data).Err()
	}
}

func userChannel(userID int64) string {
	return authx.UserChannel(userID)
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
