package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/onesignalx"
)

type groupMember struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
	Online      bool   `json:"online"`
}

func (s *server) groupRole(ctx context.Context, conversationID, userID int64) (string, error) {
	var role string
	err := s.db.QueryRow(ctx, `
		SELECT cm.role
		FROM conversation_members cm
		JOIN conversations c ON c.id=cm.conversation_id
		WHERE cm.conversation_id=$1
		  AND cm.user_id=$2
		  AND c.type='group'
	`, conversationID, userID).Scan(&role)
	return role, err
}

func (s *server) groupMembers(ctx context.Context, conversationID int64) ([]groupMember, error) {
	rows, err := s.db.Query(ctx, `
		SELECT u.id,u.username,u.display_name,cm.role
		FROM conversation_members cm
		JOIN users u ON u.id=cm.user_id
		JOIN conversations c ON c.id=cm.conversation_id
		WHERE cm.conversation_id=$1 AND c.type='group'
		ORDER BY
		  CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
		  u.username ASC
	`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []groupMember{}
	for rows.Next() {
		var item groupMember
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &item.Role); err != nil {
			return nil, err
		}
		item.Online = s.redis.Exists(ctx, presenceKey(item.ID)).Val() > 0
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *server) listGroupMembers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if _, err := s.groupRole(r.Context(), conversationID, claims.UserID); err != nil {
		httpx.Error(w, http.StatusForbidden, "not a group member")
		return
	}

	items, err := s.groupMembers(r.Context(), conversationID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load group members")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) updateGroup(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	role, err := s.groupRole(r.Context(), conversationID, claims.UserID)
	if err != nil || (role != "owner" && role != "admin") {
		httpx.Error(w, http.StatusForbidden, "group admin permission required")
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" || len(name) > 120 {
		httpx.Error(w, http.StatusBadRequest, "group name must be between 1 and 120 characters")
		return
	}

	tag, err := s.db.Exec(r.Context(), `
		UPDATE conversations
		SET name=$1
		WHERE id=$2 AND type='group'
	`, name, conversationID)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "group not found")
		return
	}

	memberIDs := s.memberIDs(r.Context(), conversationID)
	s.publishConversationEvent(r.Context(), memberIDs, realtimeEvent{
		Type:           "conversation.updated",
		ConversationID: conversationID,
	})
	httpx.JSON(w, http.StatusOK, map[string]any{
		"id":   conversationID,
		"name": name,
	})
}

func (s *server) addGroupMembers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	role, err := s.groupRole(r.Context(), conversationID, claims.UserID)
	if err != nil || (role != "owner" && role != "admin") {
		httpx.Error(w, http.StatusForbidden, "group admin permission required")
		return
	}

	var body struct {
		Usernames []string `json:"usernames"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Usernames) == 0 || len(body.Usernames) > 50 {
		httpx.Error(w, http.StatusBadRequest, "provide between 1 and 50 usernames")
		return
	}

	seen := map[string]bool{}
	type candidate struct {
		id       int64
		username string
	}
	candidates := []candidate{}
	missing := []string{}
	for _, raw := range body.Usernames {
		username := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(raw, "@")))
		if username == "" || seen[username] {
			continue
		}
		seen[username] = true
		var id int64
		if err := s.db.QueryRow(r.Context(), `
			SELECT id FROM users WHERE username=$1
		`, username).Scan(&id); err != nil {
			missing = append(missing, username)
			continue
		}
		candidates = append(candidates, candidate{id: id, username: username})
	}
	if len(missing) > 0 {
		httpx.Error(w, http.StatusBadRequest, "users not found: "+strings.Join(missing, ", "))
		return
	}
	if len(candidates) == 0 {
		httpx.Error(w, http.StatusBadRequest, "no valid users to add")
		return
	}

	addedIDs := []int64{}
	for _, candidate := range candidates {
		tag, err := s.db.Exec(r.Context(), `
			INSERT INTO conversation_members(conversation_id,user_id,role)
			VALUES($1,$2,'member')
			ON CONFLICT(conversation_id,user_id) DO NOTHING
		`, conversationID, candidate.id)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot add group member")
			return
		}
		if tag.RowsAffected() > 0 {
			addedIDs = append(addedIDs, candidate.id)
		}
	}

	memberIDs := s.memberIDs(r.Context(), conversationID)
	s.publishConversationEvent(r.Context(), memberIDs, realtimeEvent{
		Type:           "conversation.updated",
		ConversationID: conversationID,
	})

	if len(addedIDs) > 0 {
		var groupName string
		_ = s.db.QueryRow(r.Context(), `
			SELECT COALESCE(name,'Nhóm ChatNet') FROM conversations WHERE id=$1
		`, conversationID).Scan(&groupName)
		s.sendPushAsync(addedIDs, onesignalx.Notification{
			Title: groupName,
			Body:  fmt.Sprintf("@%s đã thêm bạn vào nhóm.", claims.Username),
			URL:   fmt.Sprintf("https://chat.codelocal.cloud/?conversation=%d", conversationID),
			Data:  map[string]any{"type": "group.member.added", "conversationId": conversationID},
		})
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"addedUserIds": addedIDs,
		"memberCount":  len(memberIDs),
	})
}

func (s *server) updateGroupMemberRole(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	targetID, ok := parseID(w, r.PathValue("userId"))
	if !ok {
		return
	}

	actorRole, err := s.groupRole(r.Context(), conversationID, claims.UserID)
	if err != nil || actorRole != "owner" {
		httpx.Error(w, http.StatusForbidden, "group owner permission required")
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Role != "admin" && body.Role != "member" && body.Role != "owner" {
		httpx.Error(w, http.StatusBadRequest, "role must be owner, admin or member")
		return
	}

	var targetRole string
	if err := s.db.QueryRow(r.Context(), `
		SELECT role
		FROM conversation_members
		WHERE conversation_id=$1 AND user_id=$2
	`, conversationID, targetID).Scan(&targetRole); err != nil {
		httpx.Error(w, http.StatusNotFound, "group member not found")
		return
	}
	if targetRole == "owner" || targetID == claims.UserID {
		httpx.Error(w, http.StatusBadRequest, "owner role cannot be changed here")
		return
	}

	if body.Role == "owner" {
		tx, err := s.db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot transfer ownership")
			return
		}
		defer tx.Rollback(r.Context())
		if _, err := tx.Exec(r.Context(), `
			UPDATE conversation_members
			SET role='admin'
			WHERE conversation_id=$1 AND user_id=$2 AND role='owner'
		`, conversationID, claims.UserID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot transfer ownership")
			return
		}
		if _, err := tx.Exec(r.Context(), `
			UPDATE conversation_members
			SET role='owner'
			WHERE conversation_id=$1 AND user_id=$2
		`, conversationID, targetID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot transfer ownership")
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot transfer ownership")
			return
		}
	} else {
		if _, err := s.db.Exec(r.Context(), `
			UPDATE conversation_members
			SET role=$1
			WHERE conversation_id=$2 AND user_id=$3
		`, body.Role, conversationID, targetID); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot update member role")
			return
		}
	}

	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{
		Type:           "conversation.updated",
		ConversationID: conversationID,
	})
	httpx.JSON(w, http.StatusOK, map[string]any{
		"userId": targetID,
		"role":   body.Role,
	})
}

func (s *server) removeGroupMember(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	targetID, ok := parseID(w, r.PathValue("userId"))
	if !ok {
		return
	}

	actorRole, err := s.groupRole(r.Context(), conversationID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not a group member")
		return
	}

	var targetRole string
	var targetUsername string
	if err := s.db.QueryRow(r.Context(), `
		SELECT cm.role,u.username
		FROM conversation_members cm
		JOIN users u ON u.id=cm.user_id
		WHERE cm.conversation_id=$1 AND cm.user_id=$2
	`, conversationID, targetID).Scan(&targetRole, &targetUsername); err != nil {
		httpx.Error(w, http.StatusNotFound, "group member not found")
		return
	}

	if targetID == claims.UserID {
		if actorRole == "owner" {
			httpx.Error(w, http.StatusConflict, "group owner cannot leave before transferring ownership")
			return
		}
	} else {
		switch actorRole {
		case "owner":
			if targetRole == "owner" {
				httpx.Error(w, http.StatusBadRequest, "cannot remove group owner")
				return
			}
		case "admin":
			if targetRole != "member" {
				httpx.Error(w, http.StatusForbidden, "admin can remove members only")
				return
			}
		default:
			httpx.Error(w, http.StatusForbidden, "group admin permission required")
			return
		}
	}

	if _, err := s.db.Exec(r.Context(), `
		DELETE FROM conversation_members
		WHERE conversation_id=$1 AND user_id=$2
	`, conversationID, targetID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot remove group member")
		return
	}

	recipients := s.memberIDs(r.Context(), conversationID)
	recipients = append(recipients, targetID)
	s.publishConversationEvent(r.Context(), recipients, realtimeEvent{
		Type:           "conversation.updated",
		ConversationID: conversationID,
	})

	if targetID != claims.UserID {
		var groupName string
		_ = s.db.QueryRow(r.Context(), `
			SELECT COALESCE(name,'Nhóm ChatNet') FROM conversations WHERE id=$1
		`, conversationID).Scan(&groupName)
		s.sendPushAsync([]int64{targetID}, onesignalx.Notification{
			Title: groupName,
			Body:  fmt.Sprintf("@%s đã xóa bạn khỏi nhóm.", claims.Username),
			URL:   "https://chat.codelocal.cloud/",
			Data:  map[string]any{"type": "group.member.removed", "conversationId": conversationID},
		})
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"userId":    targetID,
		"username":  targetUsername,
		"left":      targetID == claims.UserID,
		"updatedAt": time.Now().UTC(),
	})
}
