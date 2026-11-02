package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/database"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestCategoryValidation(t *testing.T) {
	for _, c := range []conversationCategory{{Name: "", Color: "blue"}, {Name: strings.Repeat("ế", 41), Color: "blue"}, {Name: "Gia\nđình", Color: "blue"}, {Name: "Gia đình", Color: "#ffffff"}} {
		if validCategory(c) {
			t.Fatalf("accepted invalid category: %+v", c)
		}
	}
	if !validCategory(conversationCategory{Name: "Gia đình", Color: "indigo"}) {
		t.Fatal("Vietnamese name rejected")
	}
}
func TestConversationCategoriesIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("local test database required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	// The additive migration must be safe to run twice.
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	users := make([]int64, 3)
	tokens := make([]string, 3)
	for i := range users {
		name := fmt.Sprintf("category_%d_%d", time.Now().UnixNano(), i)
		if err = db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!','Category Test') RETURNING id", name+"@example.invalid", name).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", users[i])
		// This CRUD fixture starts empty; default initialization has separate coverage.
		if _, err = db.Exec(ctx, "DELETE FROM conversation_categories WHERE user_id=$1", users[i]); err != nil {
			t.Fatal(err)
		}
		tokens[i], _ = authx.Sign("test", users[i], name, "Category Test")
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	routes := map[string]http.HandlerFunc{
		"GET /api/conversation-categories":                 s.listCategories,
		"POST /api/conversation-categories":                s.saveCategory,
		"PUT /api/conversation-categories/{categoryId}":    s.saveCategory,
		"DELETE /api/conversation-categories/{categoryId}": s.deleteCategory,
		"PUT /api/conversations/{id}/category":             s.assignCategory,
		"GET /api/conversations":                           s.listConversations,
	}
	for pattern, handler := range routes {
		mux.Handle(pattern, authx.Middleware("test", handler))
	}
	call := func(user int, method, path, body string, want int) []byte {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if user >= 0 {
			req.Header.Set("Authorization", "Bearer "+tokens[user])
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%s %s got %d want %d: %s", method, path, rec.Code, want, rec.Body.String())
		}
		return rec.Body.Bytes()
	}
	create := func(user int, name string) conversationCategory {
		t.Helper()
		var c conversationCategory
		json.Unmarshal(call(user, "POST", "/api/conversation-categories", fmt.Sprintf(`{"name":%q,"color":"blue"}`, name), 201), &c)
		return c
	}
	call(-1, "GET", "/api/conversation-categories", "", 401)
	cat := create(0, "Gia đình")
	other := create(1, "Công việc")
	call(0, "POST", "/api/conversation-categories", `{"name":"gia đình","color":"blue"}`, 409)
	call(0, "POST", "/api/conversation-categories", `{"name":"   ","color":"blue"}`, 400)
	call(1, "PUT", fmt.Sprintf("/api/conversation-categories/%d", cat.ID), `{"name":"Hack","color":"blue"}`, 404)
	call(1, "DELETE", fmt.Sprintf("/api/conversation-categories/%d", cat.ID), "", 404)
	var own []conversationCategory
	json.Unmarshal(call(1, "GET", "/api/conversation-categories", "", 200), &own)
	if len(own) != 1 || own[0].ID != other.ID {
		t.Fatal("category leaked across accounts")
	}
	ids := []int64{}
	for i := 0; i < 28; i++ {
		var id int64
		if err = db.QueryRow(ctx, "INSERT INTO conversations(type,name,created_by) VALUES('group',$1,$2) RETURNING id", fmt.Sprintf("Category group %d", i), users[0]).Scan(&id); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM conversations WHERE id=$1", id)
		for _, u := range users[:2] {
			if _, err = db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", id, u); err != nil {
				t.Fatal(err)
			}
		}
		ids = append(ids, id)
		call(0, "PUT", fmt.Sprintf("/api/conversations/%d/category", id), fmt.Sprintf(`{"categoryId":%d}`, cat.ID), 200)
	}
	path := fmt.Sprintf("/api/conversations/%d/category", ids[0])
	call(2, "PUT", path, fmt.Sprintf(`{"categoryId":%d}`, cat.ID), 404)
	call(1, "PUT", path, fmt.Sprintf(`{"categoryId":%d}`, cat.ID), 404)
	call(1, "PUT", path, fmt.Sprintf(`{"categoryId":%d}`, other.ID), 200)
	var page []conversation
	json.Unmarshal(call(0, "GET", fmt.Sprintf("/api/conversations?category=%d&limit=25", cat.ID), "", 200), &page)
	if len(page) != 25 {
		t.Fatalf("first filtered page: %d", len(page))
	}
	for _, c := range page {
		if c.CategoryID == nil || *c.CategoryID != cat.ID {
			t.Fatal("missing own category")
		}
	}
	json.Unmarshal(call(0, "GET", fmt.Sprintf("/api/conversations?category=%d&limit=25&offset=25", cat.ID), "", 200), &page)
	if len(page) != 3 {
		t.Fatalf("second filtered page: %d", len(page))
	}
	json.Unmarshal(call(1, "GET", fmt.Sprintf("/api/conversations?category=%d&limit=25", cat.ID), "", 200), &page)
	if len(page) != 0 {
		t.Fatal("foreign category results leaked")
	}
	call(0, "GET", "/api/conversations?category=-2&limit=25", "", 400)
	call(0, "PUT", path, `{"categoryId":null}`, 200)
	json.Unmarshal(call(0, "GET", "/api/conversations?category=0&limit=25", "", 200), &page)
	if len(page) != 1 || page[0].ID != ids[0] {
		t.Fatal("unclassified filter incorrect")
	}

	// A blocked direct chat stays hidden even when the owner filters by a private category.
	var direct int64
	if err = db.QueryRow(ctx, "INSERT INTO conversations(type,created_by) VALUES('direct',$1) RETURNING id", users[0]).Scan(&direct); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "DELETE FROM conversations WHERE id=$1", direct)
	for _, u := range users[:2] {
		if _, err = db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", direct, u); err != nil {
			t.Fatal(err)
		}
	}
	directPath := fmt.Sprintf("/api/conversations/%d/category", direct)
	call(0, "PUT", directPath, fmt.Sprintf(`{"categoryId":%d}`, cat.ID), 200)
	for _, pair := range [][2]int64{{users[0], users[1]}, {users[1], users[0]}} {
		if _, err = db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", pair[0], pair[1]); err != nil {
			t.Fatal(err)
		}
		call(0, "PUT", directPath, `{"categoryId":null}`, 403)
		var blocked []conversation
		json.Unmarshal(call(0, "GET", fmt.Sprintf("/api/conversations?category=%d&limit=100", cat.ID), "", 200), &blocked)
		for _, c := range blocked {
			if c.ID == direct {
				t.Fatal("blocked conversation leaked through category filter")
			}
		}
		db.Exec(ctx, "DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", pair[0], pair[1])
	}
	db.Exec(ctx, "DELETE FROM conversations WHERE id=$1", direct)

	call(0, "PUT", fmt.Sprintf("/api/conversation-categories/%d", cat.ID), `{"name":"Người thân","color":"green"}`, 200)
	call(0, "DELETE", fmt.Sprintf("/api/conversation-categories/%d", cat.ID), "", 200)
	var remaining int
	db.QueryRow(ctx, "SELECT count(*) FROM conversation_category_assignments WHERE user_id=$1", users[0]).Scan(&remaining)
	if remaining != 0 {
		t.Fatal("category deletion did not clear own assignments")
	}
	db.QueryRow(ctx, "SELECT count(*) FROM conversation_category_assignments WHERE user_id=$1", users[1]).Scan(&remaining)
	if remaining != 1 {
		t.Fatal("category deletion affected someone else")
	}
	// Enforce the per-user quota without affecting another account.
	for i := 0; i < 50; i++ {
		create(0, fmt.Sprintf("Quota %d", i))
	}
	call(0, "POST", "/api/conversation-categories", `{"name":"Over quota","color":"blue"}`, 409)
	// Removing membership must also remove its private assignment.
	db.Exec(ctx, "DELETE FROM conversation_members WHERE user_id=$1 AND conversation_id=$2", users[1], ids[0])
	call(1, "PUT", path, fmt.Sprintf(`{"categoryId":%d}`, other.ID), 404)
}
