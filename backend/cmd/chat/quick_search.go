package main

import (
	"net/http"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/searchx"
)

const quickSearchLimit = 5

type quickContact struct {
	ID           int64         `json:"id"`
	Name         string        `json:"name"`
	Username     string        `json:"username,omitempty"`
	Conversation *conversation `json:"conversation,omitempty"`
}

type quickHit struct {
	ID           int64        `json:"id"`
	Conversation conversation `json:"conversation"`
	Sender       string       `json:"sender"`
	Text         string       `json:"text"`
	CreatedAt    time.Time    `json:"createdAt"`
	AttachmentID int64        `json:"attachmentId,omitempty"`
	FileName     string       `json:"fileName,omitempty"`
	FileKind     string       `json:"fileKind,omitempty"`
}

type quickResults struct {
	Contacts []quickContact `json:"contacts"`
	Messages []quickHit     `json:"messages"`
	Files    []quickHit     `json:"files"`
}

// One bounded, permission-scoped request powers the search dropdown.
// Message/file results never expose storage references or unsigned media URLs.
func (s *server) quickChatSearch(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	keyword := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(keyword)) > 120 {
		httpx.Error(w, http.StatusBadRequest, "search query too long")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	result := quickResults{Contacts: []quickContact{}, Messages: []quickHit{}, Files: []quickHit{}}
	if keyword == "" {
		httpx.JSON(w, http.StatusOK, result)
		return
	}

	fold := searchx.FoldSQL
	contacts, err := s.db.Query(r.Context(), `
        SELECT u.id, u.username, COALESCE(NULLIF(BTRIM(u.display_name),''),u.username)
        FROM users u
        WHERE u.id<>$1
          AND (EXISTS (SELECT 1 FROM friend_connections fc
                WHERE fc.status='accepted' AND
                ((fc.user_low=$1 AND fc.user_high=u.id) OR (fc.user_high=$1 AND fc.user_low=u.id)))
            OR EXISTS (SELECT 1 FROM conversations c
                JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=$1
                JOIN conversation_members theirs ON theirs.conversation_id=c.id AND theirs.user_id=u.id
                WHERE c.type='direct'))
          AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
                (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocked_id=$1 AND b.blocker_id=u.id))
          AND (strpos(`+fold("u.username")+`, `+fold("$2")+`)>0
            OR strpos(`+fold("u.display_name")+`, `+fold("$2")+`)>0)
        ORDER BY u.username LIMIT $3
    `, claims.UserID, keyword, quickSearchLimit)
	if err != nil {
		httpx.Error(w, 500, "cannot search contacts")
		return
	}
	for contacts.Next() {
		var item quickContact
		if err = contacts.Scan(&item.ID, &item.Username, &item.Name); err != nil {
			break
		}
		result.Contacts = append(result.Contacts, item)
	}
	if err == nil {
		err = contacts.Err()
	}
	contacts.Close()
	if err != nil {
		httpx.Error(w, 500, "cannot read contacts")
		return
	}

	// Groups appear in the contact section too, without disclosing non-member groups.
	remaining := quickSearchLimit - len(result.Contacts)
	if remaining > 0 {
		groups, groupErr := s.db.Query(r.Context(), `
            SELECT c.id,COALESCE(c.name,''),c.created_at,
                (SELECT COUNT(*) FROM conversation_members cm2 WHERE cm2.conversation_id=c.id)
            FROM conversations c
            JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=$1
            WHERE c.type='group' AND strpos(`+fold("c.name")+`, `+fold("$2")+`)>0
            ORDER BY c.id DESC LIMIT $3
        `, claims.UserID, keyword, remaining)
		if groupErr != nil {
			httpx.Error(w, 500, "cannot search groups")
			return
		}
		for groups.Next() {
			var c conversation
			var memberCount int64
			if groupErr = groups.Scan(&c.ID, &c.Name, &c.CreatedAt, &memberCount); groupErr != nil {
				break
			}
			c.Type = "group"
			c.MemberCount = int(memberCount)
			result.Contacts = append(result.Contacts, quickContact{ID: c.ID, Name: c.Name, Conversation: &c})
		}
		if groupErr == nil {
			groupErr = groups.Err()
		}
		groups.Close()
		if groupErr != nil {
			httpx.Error(w, 500, "cannot read groups")
			return
		}
	}

	// Both sections share exactly the same membership and block visibility rules.
	for _, section := range []string{"messages", "files"} {
		attachmentJoin := ""
		fileID, fileName, fileKind := "0::bigint", "''::text", "''::text"
		match := "strpos(" + fold("m.text") + ", " + fold("$2") + ")>0"
		if section == "files" {
			attachmentJoin = "JOIN message_attachments ma ON ma.message_id=m.id"
			fileID, fileName, fileKind = "ma.id", "ma.original_name", "ma.kind"
			match = "strpos(" + fold("ma.original_name") + ", " + fold("$2") + ")>0"
		}
		query := `
            SELECT m.id,c.id,c.type,COALESCE(c.name,''),c.created_at,
                COALESCE(other.id,0),COALESCE(other.username,''),
                COALESCE(NULLIF(BTRIM(other.display_name),''),other.username,''),
                COALESCE(NULLIF(BTRIM(u.display_name),''),u.username),m.text,m.created_at,
        ` + fileID + `,` + fileName + `,` + fileKind + `
            FROM messages m
            JOIN conversations c ON c.id=m.conversation_id
            JOIN conversation_members viewer ON viewer.conversation_id=c.id AND viewer.user_id=$1
            JOIN users u ON u.id=m.user_id
            LEFT JOIN LATERAL (
                SELECT member.user_id AS id, person.username, person.display_name
                FROM conversation_members member
                JOIN users person ON person.id=member.user_id
                WHERE member.conversation_id=c.id AND member.user_id<>$1
                LIMIT 1
            ) other ON c.type='direct'
        ` + attachmentJoin + `
            WHERE m.deleted_at IS NULL AND m.id>viewer.cleared_through_message_id AND ` + match + `
              AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
                    (b.blocker_id=$1 AND b.blocked_id=m.user_id) OR (b.blocked_id=$1 AND b.blocker_id=m.user_id))
              AND (c.type<>'direct' OR NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
                    (b.blocker_id=$1 AND b.blocked_id=other.id) OR (b.blocked_id=$1 AND b.blocker_id=other.id)))
            ORDER BY m.id DESC LIMIT $3
        `
		rows, queryErr := s.db.Query(r.Context(), query, claims.UserID, keyword, quickSearchLimit)
		if queryErr != nil {
			httpx.Error(w, 500, "cannot search chat history")
			return
		}
		for rows.Next() {
			var hit quickHit
			var otherID int64
			var otherUsername, otherName string
			if queryErr = rows.Scan(&hit.ID, &hit.Conversation.ID, &hit.Conversation.Type,
				&hit.Conversation.Name, &hit.Conversation.CreatedAt,
				&otherID, &otherUsername, &otherName,
				&hit.Sender, &hit.Text, &hit.CreatedAt,
				&hit.AttachmentID, &hit.FileName, &hit.FileKind); queryErr != nil {
				break
			}
			if hit.Conversation.Type == "direct" {
				hit.Conversation.OtherUserID = &otherID
				hit.Conversation.OtherUsername = otherUsername
				hit.Conversation.Name = otherName
			}
			if section == "files" {
				result.Files = append(result.Files, hit)
			} else {
				result.Messages = append(result.Messages, hit)
			}
		}
		if queryErr == nil {
			queryErr = rows.Err()
		}
		rows.Close()
		if queryErr != nil {
			httpx.Error(w, 500, "cannot read search results")
			return
		}
	}
	httpx.JSON(w, http.StatusOK, result)
}
