package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strconv"
	"strings"
)

type communityFields struct {
	Description string `json:"description"`
	Topic       string `json:"topic"`
	Rules       string `json:"rules"`
	Visibility  string `json:"visibility"`
}
type communityProfile struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Topic       string `json:"topic"`
	Rules       string `json:"rules"`
	Visibility  string `json:"visibility"`
	MemberCount int    `json:"memberCount"`
}

func validCommunityFields(v communityFields) bool {
	return (v.Visibility == "public" || v.Visibility == "private") && len([]rune(v.Description)) <= 500 &&
		len([]rune(v.Topic)) <= 100 && len([]rune(v.Rules)) <= 5000
}
func (s *server) getCommunityProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var v communityProfile
	err := s.db.QueryRow(r.Context(), `SELECT c.id,COALESCE(c.name,''),c.group_description,c.group_topic,c.group_rules,c.group_visibility,
   (SELECT COUNT(*) FROM conversation_members WHERE conversation_id=c.id)
   FROM conversations c WHERE c.id=$1 AND c.type='group'
   AND EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=c.id AND user_id=$2)`, id, claims.UserID).
		Scan(&v.ID, &v.Name, &v.Description, &v.Topic, &v.Rules, &v.Visibility, &v.MemberCount)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 404, "group not found")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "cannot load group")
		return
	}
	httpx.JSON(w, 200, v)
}
func (s *server) patchCommunityProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var b communityFields
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&b) != nil || !validCommunityFields(b) {
		httpx.Error(w, 400, "invalid community fields")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot update group")
		return
	}
	defer tx.Rollback(r.Context())
	role, cfg, err := groupGovernanceTx(r.Context(), tx, id, claims.UserID, true)
	if err != nil || !groupPermission(role, cfg, "edit") {
		httpx.Error(w, 403, "group edit permission required")
		return
	}
	var v communityProfile
	err = tx.QueryRow(r.Context(), `UPDATE conversations
 SET group_description=$1,group_topic=$2,group_rules=$3,group_visibility=$4
 WHERE id=$5 AND type='group'
 RETURNING id,COALESCE(name,''),group_description,group_topic,group_rules,group_visibility`,
		strings.TrimSpace(b.Description), strings.TrimSpace(b.Topic), strings.TrimSpace(b.Rules), b.Visibility, id).
		Scan(&v.ID, &v.Name, &v.Description, &v.Topic, &v.Rules, &v.Visibility)
	if err != nil {
		httpx.Error(w, 500, "cannot update group")
		return
	}
	if err = writeGroupAudit(r.Context(), tx, id, claims.UserID, "community.updated", nil, map[string]any{"visibility": v.Visibility, "topic": v.Topic}); err != nil {
		httpx.Error(w, 500, "cannot record update")
		return
	}
	if tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot update group")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "conversation.updated", ConversationID: id})
	httpx.JSON(w, 200, v)
}
func (s *server) listPublicCommunities(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(q)) > 100 {
		httpx.Error(w, 400, "search too long")
		return
	}
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, e := strconv.Atoi(raw)
		if e != nil || n < 1 || n > 50 {
			httpx.Error(w, 400, "invalid limit")
			return
		}
		limit = n
	}
	rows, err := s.db.Query(r.Context(), `SELECT c.id,COALESCE(c.name,''),c.group_description,c.group_topic,c.group_visibility,
  (SELECT COUNT(*) FROM conversation_members WHERE conversation_id=c.id)
  FROM conversations c WHERE c.type='group' AND c.group_visibility='public'
  AND ($1::text='' OR strpos(lower(COALESCE(c.name,'')),lower($1))>0 OR strpos(lower(c.group_topic),lower($1))>0)
  AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE c.created_by IS NOT NULL AND
  ((b.blocker_id=$3 AND b.blocked_id=c.created_by) OR (b.blocked_id=$3 AND b.blocker_id=c.created_by)))
  ORDER BY c.id DESC LIMIT $2`, q, limit, claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot load communities")
		return
	}
	defer rows.Close()
	list := []communityProfile{}
	for rows.Next() {
		var v communityProfile
		if rows.Scan(&v.ID, &v.Name, &v.Description, &v.Topic, &v.Visibility, &v.MemberCount) != nil {
			httpx.Error(w, 500, "cannot load communities")
			return
		}
		list = append(list, v)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "cannot load communities")
		return
	}
	httpx.JSON(w, 200, list)
}
func (s *server) joinPublicCommunity(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	defer tx.Rollback(r.Context())
	var visibility string
	var approval bool
	var owner *int64
	err = tx.QueryRow(r.Context(), `SELECT c.group_visibility,COALESCE(gs.require_approval,FALSE),c.created_by
  FROM conversations c LEFT JOIN group_settings gs ON gs.conversation_id=c.id
  WHERE c.id=$1 AND c.type='group' FOR UPDATE OF c`, id).Scan(&visibility, &approval, &owner)
	if err != nil || visibility != "public" {
		httpx.Error(w, 404, "public group unavailable")
		return
	}
	if owner != nil {
		var blocked bool
		err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM user_blocks WHERE
    (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1))`, claims.UserID, *owner).Scan(&blocked)
		if err != nil || blocked {
			httpx.Error(w, 403, "cannot join this group")
			return
		}
	}
	var member, pending bool
	err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2),
  EXISTS(SELECT 1 FROM group_join_requests WHERE conversation_id=$1 AND user_id=$2 AND status='pending')`, id, claims.UserID).Scan(&member, &pending)
	if err != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	if member {
		httpx.JSON(w, 200, map[string]any{"conversationId": id, "status": "member"})
		return
	}
	if pending {
		httpx.JSON(w, 200, map[string]any{"conversationId": id, "status": "pending"})
		return
	}
	status := "member"
	if approval {
		status = "pending"
		_, err = tx.Exec(r.Context(), `INSERT INTO group_join_requests(conversation_id,user_id,status,created_at,reviewed_by,reviewed_at)
   VALUES($1,$2,'pending',NOW(),NULL,NULL) ON CONFLICT(conversation_id,user_id) DO UPDATE SET
   status='pending',created_at=NOW(),invite_id=NULL,reviewed_by=NULL,reviewed_at=NULL`, id, claims.UserID)
	} else {
		_, err = tx.Exec(r.Context(), `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING`, id, claims.UserID)
	}
	if err != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	if writeGroupAudit(r.Context(), tx, id, claims.UserID, "community.join."+status, &claims.UserID, map[string]any{"source": "public"}) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	if status == "member" {
		s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "conversation.updated", ConversationID: id})
	}
	httpx.JSON(w, 200, map[string]any{"conversationId": id, "status": status})
}

type groupNotificationPreferences struct {
	MessageNotifications bool `json:"messageNotifications"`
	MentionNotifications bool `json:"mentionNotifications"`
}

func (s *server) getGroupNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var member bool
    if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2)`, id, claims.UserID).Scan(&member); err != nil || !member {
        httpx.Error(w, 403, "not a conversation member")
        return
    }
	v := groupNotificationPreferences{MessageNotifications: true, MentionNotifications: true}
	err := s.db.QueryRow(r.Context(), `SELECT message_notifications,mention_notifications FROM group_notification_preferences WHERE conversation_id=$1 AND user_id=$2`, id, claims.UserID).Scan(&v.MessageNotifications, &v.MentionNotifications)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 500, "cannot load preferences")
		return
	}
	httpx.JSON(w, 200, v)
}
func (s *server) putGroupNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var v groupNotificationPreferences
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&v) != nil {
		httpx.Error(w, 400, "invalid preferences")
		return
	}
	tag, err := s.db.Exec(r.Context(), `INSERT INTO group_notification_preferences(conversation_id,user_id,message_notifications,mention_notifications)
  SELECT cm.conversation_id,cm.user_id,$3,$4 FROM conversation_members cm
  WHERE cm.conversation_id=$1 AND cm.user_id=$2
  ON CONFLICT(conversation_id,user_id) DO UPDATE SET message_notifications=EXCLUDED.message_notifications,
  mention_notifications=EXCLUDED.mention_notifications,updated_at=NOW()`, id, claims.UserID, v.MessageNotifications, v.MentionNotifications)
	if err != nil {
		httpx.Error(w, 500, "cannot save preferences")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 403, "not a group member")
		return
	}
	httpx.JSON(w, 200, v)
}

func hasMention(message, username string) bool {
	for _, word := range strings.Fields(strings.ToLower(message)) {
		if strings.Trim(word, " \t\n.,!?;:()[]{}") == "@"+strings.ToLower(username) {
			return true
		}
	}
	return false
}

// Only push delivery respects notification preferences; message persistence and SSE do not change.
func (s *server) groupPushRecipients(ctx context.Context, conversationID int64, channelID int64, candidates []int64, text string) []int64 {
	if len(candidates) == 0 {
		return candidates
	}
	var group bool
	if s.db.QueryRow(ctx, `SELECT type='group' FROM conversations WHERE id=$1`, conversationID).Scan(&group) != nil {
		return []int64{}
	}
	if !group {
        rows, err := s.db.Query(ctx, `SELECT cm.user_id FROM conversation_members cm
          LEFT JOIN group_notification_preferences p ON p.conversation_id=cm.conversation_id AND p.user_id=cm.user_id
          WHERE cm.conversation_id=$1 AND cm.user_id=ANY($2::bigint[])
            AND COALESCE(p.message_notifications,TRUE)`, conversationID, candidates)
        if err != nil { return []int64{} }
        defer rows.Close()
        result := []int64{}
        for rows.Next() {
            var uid int64
            if rows.Scan(&uid) != nil { return []int64{} }
            result = append(result, uid)
        }
        if rows.Err() != nil { return []int64{} }
        return result
	}
	rows, err := s.db.Query(ctx, `SELECT u.id,u.username,COALESCE(p.message_notifications,TRUE),COALESCE(p.mention_notifications,TRUE)
  FROM conversation_members cm JOIN users u ON u.id=cm.user_id
  LEFT JOIN group_notification_preferences p ON p.conversation_id=cm.conversation_id AND p.user_id=cm.user_id
  LEFT JOIN group_channel_notification_preferences cp ON cp.conversation_id=cm.conversation_id
    AND cp.user_id=cm.user_id AND cp.channel_id=$3
  WHERE cm.conversation_id=$1 AND cm.user_id=ANY($2::bigint[]) AND NOT COALESCE(cp.muted,FALSE)`, conversationID, candidates, channelID)
	if err != nil {
		return []int64{}
	}
	defer rows.Close()
	result := []int64{}
	for rows.Next() {
		var uid int64
		var username string
		var messages, mentions bool
		if rows.Scan(&uid, &username, &messages, &mentions) != nil {
			return []int64{}
		}
		if messages || (mentions && hasMention(text, username)) {
			result = append(result, uid)
		}
	}
	if rows.Err() != nil {
		return []int64{}
	}
	return result
}
