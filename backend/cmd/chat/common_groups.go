package main

import (
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

// Only return groups both callers belong to; never enumerate private memberships.
func (s *server) listCommonGroups(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	target, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if target == claims.UserID {
		httpx.Error(w, 400, "invalid contact")
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT c.id, COALESCE(c.name,''), (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id=c.id)
		FROM conversations c
		JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=$1
		JOIN conversation_members theirs ON theirs.conversation_id=c.id AND theirs.user_id=$2
		WHERE c.type='group'
		  AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		    (b.blocker_id=$1 AND b.blocked_id=$2) OR (b.blocker_id=$2 AND b.blocked_id=$1))
		ORDER BY c.id DESC LIMIT 200`, claims.UserID, target)
	if err != nil {
		httpx.Error(w, 503, "cannot load common groups")
		return
	}
	defer rows.Close()
	type commonGroup struct {
		ID          int64  `json:"id"`
		Name        string `json:"name"`
		MemberCount int64  `json:"memberCount"`
	}
	items := []commonGroup{}
	for rows.Next() {
		var item commonGroup
		if rows.Scan(&item.ID, &item.Name, &item.MemberCount) != nil {
			httpx.Error(w, 503, "cannot load common groups")
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, 503, "cannot load common groups")
		return
	}
	httpx.JSON(w, 200, items)
}
