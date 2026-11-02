package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestContactMetadataIntegration(t *testing.T) {
	dbURL := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("isolated postgres required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	ids := make([]int64, 3)
	tokens := make([]string, 2)
	for i := range ids {
		name := fmt.Sprintf("customcontact_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.com", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", ids[i])
		if i < 2 {
			tokens[i], err = authx.Sign("test", ids[i], name, name)
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	low, high := orderedUserPair(ids[0], ids[1])
	if _, err := db.Exec(ctx, `INSERT INTO friend_connections(user_low,user_high,requested_by,status)
		VALUES($1,$2,$1,'accepted')`, low, high); err != nil {
		t.Fatal(err)
	}
	call := func(actor int, method string, id int64, body string, handler http.HandlerFunc, want int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, "/api/contacts", strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+tokens[actor])
		if id > 0 {
			r.SetPathValue("id", fmt.Sprint(id))
		}
		w := httptest.NewRecorder()
		authx.Middleware("test", handler).ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("actor %d %s got %d want %d: %s", actor, method, w.Code, want, w.Body.String())
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("private contacts must not be cached")
		}
		return w
	}
	payload := `{"nickname":"Bạn thân của A","note":"Ghi chú riêng tư A","favorite":true}`
	call(0, "PUT", ids[2], payload, s.updateContactMetadata, 404)
	call(0, "PUT", ids[0], payload, s.updateContactMetadata, 400)
	call(0, "PUT", ids[1], `{"favorite":true}`, s.updateContactMetadata, 400)
	call(0, "PUT", ids[1], `{"nickname":"x","note":"","favorite":false,"unknown":"bad"}`, s.updateContactMetadata, 400)
	res := call(0, "PUT", ids[1], payload, s.updateContactMetadata, 200)
	var saved contactMetadata
	if json.Unmarshal(res.Body.Bytes(), &saved) != nil || saved.ID != ids[1] || saved.Nickname != "Bạn thân của A" || !saved.Favorite {
		t.Fatal("invalid contact metadata")
	}
	res = call(0, "GET", 0, "", s.listContactMetadata, 200)
	var aItems []contactMetadata
	if json.Unmarshal(res.Body.Bytes(), &aItems) != nil || len(aItems) != 1 || aItems[0].Note != "Ghi chú riêng tư A" {
		t.Fatalf("A lost private note: %s", res.Body.String())
	}
	res = call(1, "GET", 0, "", s.listContactMetadata, 200)
	var bItems []contactMetadata
	if json.Unmarshal(res.Body.Bytes(), &bItems) != nil || len(bItems) != 1 || bItems[0].Note != "" || bItems[0].Nickname != "" {
		t.Fatalf("B saw A private notes: %s", res.Body.String())
	}
	call(1, "PUT", ids[0], `{"nickname":"Bạn của B","note":"Riêng B","favorite":false}`, s.updateContactMetadata, 200)
	res = call(0, "GET", 0, "", s.listContactMetadata, 200)
	if json.Unmarshal(res.Body.Bytes(), &aItems) != nil || aItems[0].Nickname != "Bạn thân của A" {
		t.Fatal("B changed A nickname")
	}
	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	call(0, "PUT", ids[1], payload, s.updateContactMetadata, 404)
	res = call(0, "GET", 0, "", s.listContactMetadata, 200)
	if res.Body.String() != "[]\n" && strings.TrimSpace(res.Body.String()) != "[]" {
		t.Fatalf("blocked contact leaked: %s", res.Body.String())
	}
}
