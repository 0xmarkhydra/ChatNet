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

func TestProfileNoteValidation(t *testing.T) {
	if !validProfileNote(strings.Repeat("😀", 60), "friends") {
		t.Fatal("60 Unicode characters rejected")
	}
	for _, x := range [][2]string{{"", "friends"}, {strings.Repeat("😀", 61), "public"}, {"a\x00b", "public"}, {"hi", "invalid"}} {
		if validProfileNote(x[0], x[1]) {
			t.Fatal("invalid note accepted")
		}
	}
}
func TestProfileNotesIntegration(t *testing.T) {
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
	users := make([]int64, 3)
	names := make([]string, 3)
	tokens := make([]string, 3)
	for i := range users {
		names[i] = fmt.Sprintf("note_%d_%d", time.Now().UnixNano(), i)
		if err = db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!','Notes Test') RETURNING id", names[i]+"@example.invalid", names[i]).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", users[i])
		tokens[i], _ = authx.Sign("test", users[i], names[i], "Notes Test")
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	for pattern, fn := range map[string]http.HandlerFunc{"GET /api/profile/note": s.getProfileNote, "GET /api/users/{username}/note": s.getProfileNote, "POST /api/profile/note": s.saveProfileNote, "DELETE /api/profile/note": s.deleteProfileNote} {
		mux.Handle(pattern, authx.Middleware("test", fn))
	}
	call := func(user int, method, path, body string, want int) map[string]json.RawMessage {
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
		result := map[string]json.RawMessage{}
		json.Unmarshal(rec.Body.Bytes(), &result)
		return result
	}
	publish := func(visibility string) profileNote {
		t.Helper()
		data := call(0, "POST", "/api/profile/note", fmt.Sprintf(`{"content":"Một ngày thật đẹp 😀","visibility":%q}`, visibility), 200)
		var n profileNote
		if err = json.Unmarshal(data["note"], &n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	check := func(user int, path string, visible bool) {
		t.Helper()
		data := call(user, "GET", path, "", 200)
		if (string(data["note"]) != "null") != visible {
			t.Fatalf("wrong visibility for user %d: %s", user, data["note"])
		}
	}
	path := "/api/users/" + names[0] + "/note"
	call(-1, "POST", "/api/profile/note", `{"content":"x","visibility":"public"}`, 401)
	call(0, "POST", "/api/profile/note", `{"content":"   ","visibility":"public"}`, 400)
	note := publish("friends")
	if time.Until(note.ExpiresAt) < 23*time.Hour || time.Until(note.ExpiresAt) > 25*time.Hour {
		t.Fatal("wrong expiration")
	}
	check(0, "/api/profile/note", true)
	check(1, path, false)
	check(2, path, false)
	call(0, "PUT", "/api/profile/note", `{"content":"edit","visibility":"public"}`, 405)
	call(0, "POST", "/api/profile/note", `{"content":"edit","visibility":"public"}`, 409)
	call(1, "DELETE", "/api/profile/note", fmt.Sprintf(`{"version":%q}`, note.Version), 409)
	db.Exec(ctx, "INSERT INTO friend_connections(user_low,user_high,requested_by,status) VALUES(LEAST($1::bigint,$2::bigint),GREATEST($1::bigint,$2::bigint),$1,'accepted')", users[0], users[1])
	check(1, path, true)
	for _, pair := range [][2]int64{{users[0], users[1]}, {users[1], users[0]}} {
		db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", pair[0], pair[1])
		call(1, "GET", path, "", 404)
		db.Exec(ctx, "DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", pair[0], pair[1])
	}
	call(0, "DELETE", "/api/profile/note", fmt.Sprintf(`{"version":%q}`, note.Version), 200)
	check(1, path, false)
	note = publish("private")
	check(1, path, false)
	check(2, path, false)
	call(0, "DELETE", "/api/profile/note", fmt.Sprintf(`{"version":%q}`, note.Version), 200)
	note = publish("public")
	check(2, path, true)
	call(0, "DELETE", "/api/profile/note", `{"version":"outdated"}`, 409)
	check(0, "/api/profile/note", true)
	db.Exec(ctx, "UPDATE profile_notes SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1", users[0])
	check(0, "/api/profile/note", false)
	check(2, path, false)
	fresh := publish("friends")
	if fresh.Version == note.Version {
		t.Fatal("new note reused version")
	}
	call(0, "DELETE", "/api/profile/note", fmt.Sprintf(`{"version":%q}`, note.Version), 409)
}
