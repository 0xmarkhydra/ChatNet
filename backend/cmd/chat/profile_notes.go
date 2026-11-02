package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type profileNote struct {
	Content    string    `json:"content"`
	Visibility string    `json:"visibility"`
	Version    string    `json:"version"`
	CreatedAt  time.Time `json:"createdAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func validProfileNote(content, visibility string) bool {
	if !utf8.ValidString(content) || utf8.RuneCountInString(content) < 1 || utf8.RuneCountInString(content) > 60 {
		return false
	}
	for _, r := range content {
		if unicode.IsControl(r) && r != '\n' {
			return false
		}
	}
	return visibility == "public" || visibility == "friends" || visibility == "private"
}
func (s *server) getProfileNote(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	w.Header().Set("Cache-Control", "no-store")
	var owner int64
	username := r.PathValue("username")
	if username == "" {
		owner = claims.UserID
	} else {
		err := s.db.QueryRow(r.Context(), `SELECT u.id FROM users u WHERE u.username=$1 AND NOT EXISTS(
   SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=u.id) OR (b.blocked_id=$2 AND b.blocker_id=u.id))`, strings.ToLower(username), claims.UserID).Scan(&owner)
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, 404, "Không tìm thấy hồ sơ.")
			return
		}
		if err != nil {
			httpx.Error(w, 503, "Không tải được ghi chú.")
			return
		}
	}
	var n profileNote
	err := s.db.QueryRow(r.Context(), `SELECT content,visibility,version::text,created_at,expires_at FROM profile_notes n
 WHERE n.user_id=$1 AND n.expires_at>NOW() AND (
 n.user_id=$2 OR n.visibility='public' OR (n.visibility='friends' AND EXISTS(
  SELECT 1 FROM friend_connections f WHERE f.user_low=LEAST($1::bigint,$2::bigint) AND f.user_high=GREATEST($1::bigint,$2::bigint) AND f.status='accepted')))`, owner, claims.UserID).Scan(&n.Content, &n.Visibility, &n.Version, &n.CreatedAt, &n.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.JSON(w, 200, map[string]any{"note": nil})
		return
	}
	if err != nil {
		httpx.Error(w, 503, "Không tải được ghi chú.")
		return
	}
	httpx.JSON(w, 200, map[string]any{"note": n})
}
func (s *server) saveProfileNote(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Content    string `json:"content"`
		Visibility string `json:"visibility"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, 400, "Ghi chú không hợp lệ.")
		return
	}
	body.Content = strings.TrimSpace(body.Content)
	if !validProfileNote(body.Content, body.Visibility) {
		httpx.Error(w, 400, "Ghi chú cần 1–60 ký tự và quyền xem hợp lệ.")
		return
	}
	var n profileNote
	err := s.db.QueryRow(r.Context(), `INSERT INTO profile_notes(user_id,content,visibility) VALUES($1,$2,$3)
 ON CONFLICT(user_id) DO UPDATE SET content=EXCLUDED.content,visibility=EXCLUDED.visibility,version=gen_random_uuid(),created_at=NOW(),expires_at=NOW()+INTERVAL '24 hours'
 WHERE profile_notes.expires_at<=NOW()
 RETURNING content,visibility,version::text,created_at,expires_at`, claims.UserID, body.Content, body.Visibility).Scan(&n.Content, &n.Visibility, &n.Version, &n.CreatedAt, &n.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 409, "Bạn đã có ghi chú đang hiển thị. Hãy xóa trước khi đăng ghi chú mới.")
		return
	}
	if err != nil {
		httpx.Error(w, 503, "Chưa lưu được ghi chú. Hãy tải lại để kiểm tra.")
		return
	}
	httpx.JSON(w, 200, map[string]any{"note": n})
}
func (s *server) deleteProfileNote(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Version string `json:"version"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body) != nil || body.Version == "" {
		httpx.Error(w, 400, "Thiếu phiên bản ghi chú.")
		return
	}
	result, err := s.db.Exec(r.Context(), "DELETE FROM profile_notes WHERE user_id=$1 AND version::text=$2", claims.UserID, body.Version)
	if err != nil {
		httpx.Error(w, 503, "Chưa xóa được ghi chú. Hãy tải lại để kiểm tra.")
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(w, 409, "Ghi chú đã thay đổi. Hãy tải lại.")
		return
	}
	httpx.JSON(w, 200, map[string]any{"note": nil})
}
