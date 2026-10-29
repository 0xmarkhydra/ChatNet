package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"
)

type conversationCategory struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

func validCategory(c conversationCategory) bool {
	if utf8.RuneCountInString(c.Name) < 1 || utf8.RuneCountInString(c.Name) > 40 {
		return false
	}
	for _, r := range c.Name {
		if unicode.IsControl(r) {
			return false
		}
	}
	switch c.Color {
	case "indigo", "blue", "green", "orange", "pink", "slate":
		return true
	}
	return false
}

func (s *server) categoryChanged(r *http.Request, userID, conversationID int64, categoryID *int64) {
	if s.redis != nil {
		s.publishConversationEvent(r.Context(), []int64{userID}, realtimeEvent{Type: "category.updated", ConversationID: conversationID, CategoryID: categoryID})
	}
}

func categoryError(w http.ResponseWriter, err error) {
	var pgerr *pgconn.PgError
	if errors.As(err, &pgerr) && pgerr.Code == "23505" {
		httpx.Error(w, 409, "Tên phân loại đã tồn tại.")
		return
	}
	if errors.As(err, &pgerr) && pgerr.Code == "23503" {
		httpx.Error(w, 409, "Phân loại hoặc hội thoại đã thay đổi. Hãy tải lại.")
		return
	}
	httpx.Error(w, 500, "Không lưu được phân loại.")
}

func (s *server) listCategories(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), "SELECT id,name,color FROM conversation_categories WHERE user_id=$1 ORDER BY lower(name),id LIMIT 50", claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "Không tải được phân loại.")
		return
	}
	defer rows.Close()
	items := []conversationCategory{}
	for rows.Next() {
		var c conversationCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.Color); err != nil {
			httpx.Error(w, 500, "Không tải được phân loại.")
			return
		}
		items = append(items, c)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "Không tải được phân loại.")
		return
	}
	httpx.JSON(w, 200, items)
}

func (s *server) saveCategory(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	var c conversationCategory
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&c) != nil {
		httpx.Error(w, 400, "Dữ liệu phân loại không hợp lệ.")
		return
	}
	c.Name = strings.TrimSpace(c.Name)
	if !validCategory(c) {
		httpx.Error(w, 400, "Tên phải có 1–40 ký tự và màu hợp lệ.")
		return
	}
	if r.Method == http.MethodPut {
		id, ok := parseID(w, r.PathValue("categoryId"))
		if !ok {
			return
		}
		err := s.db.QueryRow(r.Context(), "UPDATE conversation_categories SET name=$1,color=$2 WHERE id=$3 AND user_id=$4 RETURNING id", c.Name, c.Color, id, claims.UserID).Scan(&c.ID)
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, 404, "Không tìm thấy phân loại.")
			return
		}
		if err != nil {
			categoryError(w, err)
			return
		}
	} else {
		tx, err := s.db.Begin(r.Context())
		if err != nil {
			categoryError(w, err)
			return
		}
		defer tx.Rollback(r.Context())
		// Serialize the small per-user quota, including concurrent creates.
		var owner int64
		if err = tx.QueryRow(r.Context(), "SELECT id FROM users WHERE id=$1 FOR UPDATE", claims.UserID).Scan(&owner); err != nil {
			categoryError(w, err)
			return
		}
		var count int
		if err = tx.QueryRow(r.Context(), "SELECT count(*) FROM conversation_categories WHERE user_id=$1", owner).Scan(&count); err != nil {
			categoryError(w, err)
			return
		}
		if count >= 50 {
			httpx.Error(w, 409, "Bạn có thể tạo tối đa 50 phân loại.")
			return
		}
		if err = tx.QueryRow(r.Context(), "INSERT INTO conversation_categories(user_id,name,color) VALUES($1,$2,$3) RETURNING id", owner, c.Name, c.Color).Scan(&c.ID); err != nil {
			categoryError(w, err)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			categoryError(w, err)
			return
		}
	}
	s.categoryChanged(r, claims.UserID, 0, nil)
	status := 200
	if r.Method == http.MethodPost {
		status = 201
	}
	httpx.JSON(w, status, c)
}

func (s *server) deleteCategory(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("categoryId"))
	if !ok {
		return
	}
	result, err := s.db.Exec(r.Context(), "DELETE FROM conversation_categories WHERE id=$1 AND user_id=$2", id, claims.UserID)
	if err != nil {
		categoryError(w, err)
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(w, 404, "Không tìm thấy phân loại.")
		return
	}
	s.categoryChanged(r, claims.UserID, 0, nil)
	httpx.JSON(w, 200, map[string]bool{"ok": true})
}

func (s *server) assignCategory(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body struct {
		CategoryID *int64 `json:"categoryId"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&body) != nil || (body.CategoryID != nil && *body.CategoryID <= 0) {
		httpx.Error(w, 400, "Phân loại không hợp lệ.")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		categoryError(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	var member int64
	err = tx.QueryRow(r.Context(), "SELECT user_id FROM conversation_members WHERE conversation_id=$1 AND user_id=$2 FOR KEY SHARE", id, claims.UserID).Scan(&member)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 404, "Không tìm thấy hội thoại.")
		return
	}
	if err != nil {
		categoryError(w, err)
		return
	}
	// Reuse the existing bilateral block policy before changing a direct conversation.
	if !s.allowDirectConversation(w, r, id, claims.UserID) {
		return
	}
	if body.CategoryID == nil {
		_, err = tx.Exec(r.Context(), "DELETE FROM conversation_category_assignments WHERE user_id=$1 AND conversation_id=$2", claims.UserID, id)
	} else {
		var category int64
		err = tx.QueryRow(r.Context(), "SELECT id FROM conversation_categories WHERE user_id=$1 AND id=$2 FOR KEY SHARE", claims.UserID, *body.CategoryID).Scan(&category)
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, 404, "Không tìm thấy phân loại.")
			return
		}
		if err == nil {
			_, err = tx.Exec(r.Context(), `INSERT INTO conversation_category_assignments(user_id,conversation_id,category_id) VALUES($1,$2,$3) ON CONFLICT(user_id,conversation_id) DO UPDATE SET category_id=EXCLUDED.category_id`, claims.UserID, id, category)
		}
	}
	if err != nil {
		categoryError(w, err)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		categoryError(w, err)
		return
	}
	s.categoryChanged(r, claims.UserID, id, body.CategoryID)
	httpx.JSON(w, 200, map[string]any{"conversationId": id, "categoryId": body.CategoryID})
}
