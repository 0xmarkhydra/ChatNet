package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type groupGovernanceSettings struct {
	RequireApproval  bool `json:"requireApproval"`
	AdminCanInvite   bool `json:"adminCanInvite"`
	AdminCanApprove  bool `json:"adminCanApprove"`
	AdminCanEditInfo bool `json:"adminCanEditInfo"`
}

type groupInviteLink struct {
	ID        int64      `json:"id"`
	ExpiresAt time.Time  `json:"expiresAt"`
	MaxUses   *int       `json:"maxUses"`
	UseCount  int        `json:"useCount"`
	RevokedAt *time.Time `json:"revokedAt"`
	CreatedAt time.Time  `json:"createdAt"`
}

type groupJoinRequest struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"userId"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (s *server) groupGovernance(ctx context.Context, groupID, userID int64) (string, groupGovernanceSettings, error) {
	var role string
	v := groupGovernanceSettings{}
	err := s.db.QueryRow(ctx, `
  SELECT cm.role, COALESCE(gs.require_approval,FALSE),
   COALESCE(gs.admin_can_invite,TRUE), COALESCE(gs.admin_can_approve,TRUE),
   COALESCE(gs.admin_can_edit_info,TRUE)
  FROM conversation_members cm
  JOIN conversations c ON c.id=cm.conversation_id AND c.type='group'
  LEFT JOIN group_settings gs ON gs.conversation_id=cm.conversation_id
  WHERE cm.conversation_id=$1 AND cm.user_id=$2
 `, groupID, userID).Scan(&role, &v.RequireApproval, &v.AdminCanInvite, &v.AdminCanApprove, &v.AdminCanEditInfo)
	return role, v, err
}

func groupPermission(role string, v groupGovernanceSettings, action string) bool {
	if role == "owner" {
		return true
	}
	if role != "admin" {
		return false
	}
	switch action {
	case "invite":
		return v.AdminCanInvite
	case "approve":
		return v.AdminCanApprove
	case "edit":
		return v.AdminCanEditInfo
	case "audit":
		return true
	default:
		return false
	}
}

func inviteHash(token string) (string, bool) {
	if len(token) != 64 {
		return "", false
	}
	b, err := hex.DecodeString(token)
	if err != nil || len(b) != 32 {
		return "", false
	}
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:]), true
}

// Persist only audit metadata, never plaintext invitation tokens or message bodies.
func writeGroupAudit(ctx context.Context, tx pgx.Tx, groupID, actorID int64, action string, targetID *int64, details any) error {
	value, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO group_admin_audit(conversation_id,actor_id,action,target_user_id,details)
  VALUES($1,$2,$3,$4,$5::jsonb)`, groupID, actorID, action, targetID, string(value))
	return err
}

func (s *server) getGroupSettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	_, v, err := s.groupGovernance(r.Context(), id, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not a group member")
		return
	}
	httpx.JSON(w, http.StatusOK, v)
}

func (s *server) patchGroupSettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body groupGovernanceSettings
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil {
		httpx.Error(w, 400, "invalid settings")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot update settings")
		return
	}
	defer tx.Rollback(r.Context())
	var role string
	err = tx.QueryRow(r.Context(), `SELECT role FROM conversation_members WHERE conversation_id=$1 AND user_id=$2 FOR UPDATE`, id, claims.UserID).Scan(&role)
	if err != nil || role != "owner" {
		httpx.Error(w, 403, "group owner permission required")
		return
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO group_settings(conversation_id,require_approval,admin_can_invite,admin_can_approve,admin_can_edit_info)
 VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(conversation_id) DO UPDATE SET require_approval=EXCLUDED.require_approval,
 admin_can_invite=EXCLUDED.admin_can_invite,admin_can_approve=EXCLUDED.admin_can_approve,admin_can_edit_info=EXCLUDED.admin_can_edit_info`,
		id, body.RequireApproval, body.AdminCanInvite, body.AdminCanApprove, body.AdminCanEditInfo)
	if err != nil || writeGroupAudit(r.Context(), tx, id, claims.UserID, "settings.updated", nil, body) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot update settings")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "conversation.updated", ConversationID: id})
	httpx.JSON(w, 200, body)
}

func (s *server) createGroupInvite(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body struct {
		ExpiresInHours int `json:"expiresInHours"`
		MaxUses        int `json:"maxUses"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil || body.ExpiresInHours < 1 || body.ExpiresInHours > 720 || body.MaxUses < 0 || body.MaxUses > 10000 {
		httpx.Error(w, 400, "expiry must be 1-720 hours and maxUses 0-10000")
		return
	}
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		httpx.Error(w, 500, "cannot create invitation")
		return
	}
	token := hex.EncodeToString(bytes)
	hash, _ := inviteHash(token)
	expires := time.Now().UTC().Add(time.Duration(body.ExpiresInHours) * time.Hour)
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot create invitation")
		return
	}
	defer tx.Rollback(r.Context())
	role, v, err := groupGovernanceTx(r.Context(), tx, id, claims.UserID, true)
	if err != nil || !groupPermission(role, v, "invite") {
		httpx.Error(w, 403, "group invitation permission required")
		return
	}
	var linkID int64
	var max *int
	if body.MaxUses > 0 {
		max = &body.MaxUses
	}
	err = tx.QueryRow(r.Context(), `INSERT INTO group_invite_links(conversation_id,token_hash,created_by,expires_at,max_uses)
 VALUES($1,$2,$3,$4,$5) RETURNING id`, id, hash, claims.UserID, expires, max).Scan(&linkID)
	if err != nil || writeGroupAudit(r.Context(), tx, id, claims.UserID, "invite.created", nil, map[string]any{"inviteId": linkID, "expiresAt": expires, "maxUses": max}) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot create invitation")
		return
	}
	httpx.JSON(w, 201, map[string]any{"id": linkID, "token": token, "expiresAt": expires, "maxUses": max})
}

func groupGovernanceTx(ctx context.Context, tx pgx.Tx, groupID, userID int64, lock bool) (string, groupGovernanceSettings, error) {
	role := ""
	v := groupGovernanceSettings{}
	lockSuffix := ""
	if lock {
		lockSuffix = " FOR UPDATE OF cm"
	}
	err := tx.QueryRow(ctx, `SELECT cm.role,COALESCE(gs.require_approval,FALSE),COALESCE(gs.admin_can_invite,TRUE),
 COALESCE(gs.admin_can_approve,TRUE),COALESCE(gs.admin_can_edit_info,TRUE)
 FROM conversation_members cm JOIN conversations c ON c.id=cm.conversation_id AND c.type='group'
 LEFT JOIN group_settings gs ON gs.conversation_id=cm.conversation_id
 WHERE cm.conversation_id=$1 AND cm.user_id=$2`+lockSuffix, groupID, userID).Scan(&role, &v.RequireApproval, &v.AdminCanInvite, &v.AdminCanApprove, &v.AdminCanEditInfo)
	return role, v, err
}

func (s *server) listGroupInvites(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	role, cfg, err := s.groupGovernance(r.Context(), id, claims.UserID)
	if err != nil || !groupPermission(role, cfg, "invite") {
		httpx.Error(w, 403, "group invitation permission required")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT id,expires_at,max_uses,use_count,revoked_at,created_at FROM group_invite_links
 WHERE conversation_id=$1 ORDER BY id DESC LIMIT 50`, id)
	if err != nil {
		httpx.Error(w, 500, "cannot load invitations")
		return
	}
	defer rows.Close()
	items := []groupInviteLink{}
	for rows.Next() {
		var v groupInviteLink
		if rows.Scan(&v.ID, &v.ExpiresAt, &v.MaxUses, &v.UseCount, &v.RevokedAt, &v.CreatedAt) != nil {
			httpx.Error(w, 500, "cannot load invitations")
			return
		}
		items = append(items, v)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "cannot load invitations")
		return
	}
	httpx.JSON(w, 200, items)
}

func (s *server) revokeGroupInvite(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	inviteID, ok := parseID(w, r.PathValue("inviteId"))
	if !ok {
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot revoke invitation")
		return
	}
	defer tx.Rollback(r.Context())
	role, v, err := groupGovernanceTx(r.Context(), tx, id, claims.UserID, true)
	if err != nil || !groupPermission(role, v, "invite") {
		httpx.Error(w, 403, "group invitation permission required")
		return
	}
	tag, err := tx.Exec(r.Context(), `UPDATE group_invite_links SET revoked_at=NOW()
 WHERE id=$1 AND conversation_id=$2 AND revoked_at IS NULL`, inviteID, id)
	if err != nil {
		httpx.Error(w, 500, "cannot revoke invitation")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "active invitation not found")
		return
	}
	if writeGroupAudit(r.Context(), tx, id, claims.UserID, "invite.revoked", nil, map[string]any{"inviteId": inviteID}) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot revoke invitation")
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (s *server) previewGroupInvite(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	hash, ok := inviteHash(r.PathValue("token"))
	if !ok {
		httpx.Error(w, 404, "invitation not found")
		return
	}
	var id int64
	var name string
	var expires time.Time
	var require bool
	var memberCount int
	var used int
	var max *int
	var revoked *time.Time
	err := s.db.QueryRow(r.Context(), `SELECT l.conversation_id,COALESCE(c.name,'Nhóm ChatNet'),l.expires_at,
 COALESCE(gs.require_approval,FALSE),(SELECT COUNT(*) FROM conversation_members WHERE conversation_id=c.id),
 l.use_count,l.max_uses,l.revoked_at
 FROM group_invite_links l JOIN conversations c ON c.id=l.conversation_id AND c.type='group'
 LEFT JOIN group_settings gs ON gs.conversation_id=c.id
 WHERE l.token_hash=$1`, hash).Scan(&id, &name, &expires, &require, &memberCount, &used, &max, &revoked)
	if err != nil || revoked != nil || !time.Now().Before(expires) || (max != nil && used >= *max) {
		httpx.Error(w, 410, "invitation expired or unavailable")
		return
	}
	var member bool
	var pending bool
	_ = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2),
 EXISTS(SELECT 1 FROM group_join_requests WHERE conversation_id=$1 AND user_id=$2 AND status='pending')`, id, claims.UserID).Scan(&member, &pending)
	httpx.JSON(w, 200, map[string]any{"conversationId": id, "name": name, "memberCount": memberCount, "requireApproval": require, "expiresAt": expires, "isMember": member, "pending": pending})
}

func (s *server) joinGroupInvite(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	hash, ok := inviteHash(r.PathValue("token"))
	if !ok {
		httpx.Error(w, 404, "invitation not found")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	defer tx.Rollback(r.Context())
	var groupID, linkID int64
	var expires time.Time
	var max *int
	var uses int
	var revoked *time.Time
	var approval bool
	err = tx.QueryRow(r.Context(), `SELECT l.id,l.conversation_id,l.expires_at,l.max_uses,l.use_count,l.revoked_at,
 COALESCE(gs.require_approval,FALSE) FROM group_invite_links l
 JOIN conversations c ON c.id=l.conversation_id AND c.type='group'
 LEFT JOIN group_settings gs ON gs.conversation_id=c.id
 WHERE l.token_hash=$1 FOR UPDATE OF l`, hash).Scan(&linkID, &groupID, &expires, &max, &uses, &revoked, &approval)
	if err != nil || revoked != nil || !time.Now().Before(expires) || (max != nil && uses >= *max) {
		httpx.Error(w, 410, "invitation expired or unavailable")
		return
	}
	var member bool
	var pending bool
	err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2),
 EXISTS(SELECT 1 FROM group_join_requests WHERE conversation_id=$1 AND user_id=$2 AND status='pending')`, groupID, claims.UserID).Scan(&member, &pending)
	if err != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	if member || pending {
		httpx.JSON(w, 200, map[string]any{"conversationId": groupID, "status": map[bool]string{true: "member", false: "pending"}[member]})
		return
	}
	if approval {
		_, err = tx.Exec(r.Context(), `INSERT INTO group_join_requests(conversation_id,user_id,invite_id,status,created_at,reviewed_by,reviewed_at)
 VALUES($1,$2,$3,'pending',NOW(),NULL,NULL)
 ON CONFLICT(conversation_id,user_id) DO UPDATE SET status='pending',invite_id=EXCLUDED.invite_id,
 created_at=NOW(),reviewed_by=NULL,reviewed_at=NULL`, groupID, claims.UserID, linkID)
	} else {
		_, err = tx.Exec(r.Context(), `INSERT INTO conversation_members(conversation_id,user_id,role)
 VALUES($1,$2,'member') ON CONFLICT DO NOTHING`, groupID, claims.UserID)
	}
	if err != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	_, err = tx.Exec(r.Context(), `UPDATE group_invite_links SET use_count=use_count+1 WHERE id=$1`, linkID)
	if err != nil || writeGroupAudit(r.Context(), tx, groupID, claims.UserID, map[bool]string{true: "join.requested", false: "member.joined"}[approval], &claims.UserID, map[string]any{"inviteId": linkID}) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot join group")
		return
	}
	if !approval {
		s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), groupID), realtimeEvent{Type: "conversation.updated", ConversationID: groupID})
	}
	httpx.JSON(w, 200, map[string]any{"conversationId": groupID, "status": map[bool]string{true: "pending", false: "member"}[approval]})
}

func (s *server) listGroupJoinRequests(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	role, v, err := s.groupGovernance(r.Context(), id, claims.UserID)
	if err != nil || !groupPermission(role, v, "approve") {
		httpx.Error(w, 403, "group approval permission required")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT jr.id,jr.user_id,u.username,u.display_name,jr.created_at
 FROM group_join_requests jr JOIN users u ON u.id=jr.user_id
 WHERE jr.conversation_id=$1 AND jr.status='pending' ORDER BY jr.created_at ASC LIMIT 100`, id)
	if err != nil {
		httpx.Error(w, 500, "cannot load requests")
		return
	}
	defer rows.Close()
	items := []groupJoinRequest{}
	for rows.Next() {
		v := groupJoinRequest{}
		if rows.Scan(&v.ID, &v.UserID, &v.Username, &v.DisplayName, &v.CreatedAt) != nil {
			httpx.Error(w, 500, "cannot load requests")
			return
		}
		items = append(items, v)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "cannot load requests")
		return
	}
	httpx.JSON(w, 200, items)
}

func (s *server) reviewGroupJoinRequest(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	reqID, ok := parseID(w, r.PathValue("requestId"))
	if !ok {
		return
	}
	var body struct {
		Approve bool `json:"approve"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil {
		httpx.Error(w, 400, "invalid request")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot review request")
		return
	}
	defer tx.Rollback(r.Context())
	role, v, err := groupGovernanceTx(r.Context(), tx, id, claims.UserID, true)
	if err != nil || !groupPermission(role, v, "approve") {
		httpx.Error(w, 403, "group approval permission required")
		return
	}
	var targetID int64
	err = tx.QueryRow(r.Context(), `SELECT user_id FROM group_join_requests
 WHERE id=$1 AND conversation_id=$2 AND status='pending' FOR UPDATE`, reqID, id).Scan(&targetID)
	if err != nil {
		httpx.Error(w, 404, "pending request not found")
		return
	}
	if body.Approve {
		_, err = tx.Exec(r.Context(), `INSERT INTO conversation_members(conversation_id,user_id,role)
   VALUES($1,$2,'member') ON CONFLICT DO NOTHING`, id, targetID)
		if err != nil {
			httpx.Error(w, 500, "cannot approve request")
			return
		}
	}
	status := "rejected"
	action := "join.rejected"
	if body.Approve {
		status = "approved"
		action = "join.approved"
	}
	_, err = tx.Exec(r.Context(), `UPDATE group_join_requests SET status=$1,reviewed_by=$2,reviewed_at=NOW()
 WHERE id=$3`, status, claims.UserID, reqID)
	if err != nil || writeGroupAudit(r.Context(), tx, id, claims.UserID, action, &targetID, map[string]any{"requestId": reqID}) != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot review request")
		return
	}
	if body.Approve {
		s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "conversation.updated", ConversationID: id})
	}
	httpx.JSON(w, 200, map[string]any{"ok": true, "status": status, "userId": targetID})
}

func (s *server) listGroupAudit(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	role, v, err := s.groupGovernance(r.Context(), id, claims.UserID)
	if err != nil || !groupPermission(role, v, "audit") {
		httpx.Error(w, 403, "group admin permission required")
		return
	}
	before := int64(9223372036854775807)
	if v := r.URL.Query().Get("before"); v != "" {
		before, err = strconv.ParseInt(v, 10, 64)
		if err != nil || before < 1 {
			httpx.Error(w, 400, "invalid before cursor")
			return
		}
	}
	rows, err := s.db.Query(r.Context(), `SELECT a.id,a.actor_id,COALESCE(u.username,''),a.action,a.target_user_id,a.details,a.created_at
 FROM group_admin_audit a LEFT JOIN users u ON u.id=a.actor_id
 WHERE a.conversation_id=$1 AND a.id<$2 ORDER BY a.id DESC LIMIT 50`, id, before)
	if err != nil {
		httpx.Error(w, 500, "cannot load audit")
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var key int64
		var actorID, targetID *int64
		var actor, action string
		var details json.RawMessage
		var date time.Time
		if rows.Scan(&key, &actorID, &actor, &action, &targetID, &details, &date) != nil {
			httpx.Error(w, 500, "cannot load audit")
			return
		}
		items = append(items, map[string]any{"id": key, "actorId": actorID, "actor": actor, "action": action, "targetUserId": targetID, "details": details, "createdAt": date})
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "cannot load audit")
		return
	}
	httpx.JSON(w, 200, items)
}
