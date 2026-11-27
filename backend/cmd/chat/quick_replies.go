package main

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

var quickReplyKey = regexp.MustCompile(`^[a-z0-9_-]{1,32}$`)

type quickReply struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

func (s *server) listQuickReplies(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `SELECT shortcut,body FROM chat_quick_replies WHERE user_id=$1 ORDER BY shortcut LIMIT 100`, claims.UserID)
	if err != nil {
		httpx.Error(w, 503, "cannot load quick replies")
		return
	}
	defer rows.Close()
	items := []quickReply{}
	for rows.Next() {
		var v quickReply
		if rows.Scan(&v.Key, &v.Text) != nil {
			httpx.Error(w, 503, "cannot load quick replies")
			return
		}
		items = append(items, v)
	}
	if rows.Err() != nil {
		httpx.Error(w, 503, "cannot load quick replies")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, items)
}

func (s *server) mutateQuickReply(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	key := strings.ToLower(strings.TrimSpace(r.PathValue("key")))
	if !quickReplyKey.MatchString(key) {
		httpx.Error(w, 400, "invalid shortcut")
		return
	}
	if r.Method == http.MethodDelete {
		if _, err := s.db.Exec(r.Context(), `DELETE FROM chat_quick_replies WHERE user_id=$1 AND shortcut=$2`, claims.UserID, key); err != nil {
			httpx.Error(w, 503, "cannot delete quick reply")
			return
		}
	} else {
		var v struct {
			Text string `json:"text"`
		}
		if json.NewDecoder(http.MaxBytesReader(w, r.Body, 32768)).Decode(&v) != nil {
			httpx.Error(w, 400, "invalid reply")
			return
		}
		v.Text = strings.TrimSpace(v.Text)
		if v.Text == "" || utf8.RuneCountInString(v.Text) > 4000 {
			httpx.Error(w, 400, "invalid reply")
			return
		}
		tx, err := s.db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, 503, "cannot save quick reply")
			return
		}
		defer tx.Rollback(r.Context())
		var uid int64
		if err = tx.QueryRow(r.Context(), `SELECT id FROM users WHERE id=$1 FOR UPDATE`, claims.UserID).Scan(&uid); err != nil {
			httpx.Error(w, 503, "cannot save quick reply")
			return
		}
		var count int
		if err = tx.QueryRow(r.Context(), `SELECT COUNT(*) FROM chat_quick_replies WHERE user_id=$1 AND shortcut<>$2`, claims.UserID, key).Scan(&count); err != nil {
			httpx.Error(w, 503, "cannot save quick reply")
			return
		}
		if count >= 100 {
			httpx.Error(w, 409, "quick reply limit")
			return
		}
		if _, err = tx.Exec(r.Context(), `INSERT INTO chat_quick_replies(user_id,shortcut,body) VALUES($1,$2,$3) ON CONFLICT(user_id,shortcut) DO UPDATE SET body=EXCLUDED.body`, claims.UserID, key, v.Text); err != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 503, "cannot save quick reply")
			return
		}
	}
	httpx.JSON(w, 200, map[string]bool{"ok": true})
}
