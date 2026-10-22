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

	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSessionManagementIntegration(t *testing.T) {
	databaseURL := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for isolated PostgreSQL integration")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db, jwtSecret: "session-management-test"}
	users := make([]user, 2)
	for i := range users {
		name, err := newUsername()
		if err != nil {
			t.Fatal(err)
		}
		err = db.QueryRow(ctx, `INSERT INTO users(email,username,display_name,password_hash)
			VALUES($1,$2,$2,'!') RETURNING id,email,username,display_name,created_at`,
			fmt.Sprintf("device_%d_%s@example.com", i, name), name).
			Scan(&users[i].ID, &users[i].Email, &users[i].Username,
				&users[i].DisplayName, &users[i].CreatedAt)
		if err != nil {
			t.Fatal(err)
		}
		userID := users[i].ID
		defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", userID)
	}
	type credentials struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refreshToken"`
	}
	newSession := func(actor int, agent string) credentials {
		t.Helper()
		request := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		request.Header.Set("User-Agent", agent)
		recorder := httptest.NewRecorder()
		s.startSession(recorder, request, users[actor], http.StatusOK)
		var result credentials
		if recorder.Code != 200 || json.Unmarshal(recorder.Body.Bytes(), &result) != nil || len(result.RefreshToken) != 43 {
			t.Fatalf("cannot create session: %d %s", recorder.Code, recorder.Body.String())
		}
		return result
	}
	request := func(handler http.HandlerFunc, body string, status int) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		handler(w, httptest.NewRequest(http.MethodPost, "/api/auth/sessions", strings.NewReader(body)))
		if w.Code != status {
			t.Fatalf("status %d expected %d: %s", w.Code, status, w.Body.String())
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("session secrets response must not be cached")
		}
		return w
	}
	a := newSession(0, "ChatNet Web A")
	a2 := newSession(0, "ChatNet Web A2")
	b := newSession(1, "ChatNet Web B")
	identityBody := func(token string) string {
		body, _ := json.Marshal(map[string]string{"refreshToken": token})
		return string(body)
	}
	list := func(token string, status int) []managedSession {
		t.Helper()
		recorder := request(s.listSessions, identityBody(token), status)
		if status != http.StatusOK {
			return nil
		}
		var items []managedSession
		if err := json.Unmarshal(recorder.Body.Bytes(), &items); err != nil {
			t.Fatal(err)
		}
		for _, item := range items {
			if strings.Contains(string(recorder.Body.Bytes()), sessionHash(token)) {
				t.Fatal("session hash leaked to client")
			}
			if item.ID == "" || item.ExpiresAt.IsZero() {
				t.Fatalf("invalid session metadata: %+v", item)
			}
		}
		return items
	}
	aSessions := list(a.RefreshToken, http.StatusOK)
	if len(aSessions) != 2 {
		t.Fatalf("user A should see two sessions, got %d", len(aSessions))
	}
	if got := list(b.RefreshToken, http.StatusOK); len(got) != 1 {
		t.Fatalf("user B should see only its session, got %d", len(got))
	}
	var aID, a2ID, bID string
	for _, item := range aSessions {
		switch item.UserAgent {
		case "ChatNet Web A":
			aID = item.ID
			if !item.Current {
				t.Fatal("current session marker missing")
			}
		case "ChatNet Web A2":
			a2ID = item.ID
			if item.Current {
				t.Fatal("other session marked current")
			}
		}
	}
	if aID == "" || a2ID == "" {
		t.Fatalf("missing agent metadata: %+v", aSessions)
	}
	bID = list(b.RefreshToken, http.StatusOK)[0].ID
	revokeBody := func(token, id string) string {
		body, _ := json.Marshal(map[string]string{"refreshToken": token, "sessionId": id})
		return string(body)
	}
	request(s.revokeSession, revokeBody(a.RefreshToken, bID), http.StatusNotFound)
	if len(list(b.RefreshToken, http.StatusOK)) != 1 {
		t.Fatal("cross-account revocation succeeded")
	}
	request(s.revokeSession, revokeBody(a.RefreshToken, "invalid"), http.StatusBadRequest)
	request(s.revokeSession, revokeBody(a.RefreshToken, a2ID), http.StatusNoContent)
	list(a2.RefreshToken, http.StatusUnauthorized)
	if len(list(a.RefreshToken, http.StatusOK)) != 1 {
		t.Fatal("other session was not revoked")
	}
	third := newSession(0, "ChatNet Web Third")
	request(s.revokeOtherSessions, identityBody(a.RefreshToken), http.StatusNoContent)
	list(third.RefreshToken, http.StatusUnauthorized)
	if len(list(a.RefreshToken, http.StatusOK)) != 1 {
		t.Fatal("revoke others should keep only current session")
	}
	request(s.revokeSession, revokeBody(a.RefreshToken, aID), http.StatusNoContent)
	list(a.RefreshToken, http.StatusUnauthorized)
	// A revoked access token cannot re-open a fresh refresh credential.
	request(s.refresh, `{"refreshToken":""}`, http.StatusUnauthorized)
	w := httptest.NewRecorder()
	legacy := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{}`))
	legacy.Header.Set("Authorization", "Bearer "+a.Token)
	s.refresh(w, legacy)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("revoked JWT re-created a session: %d", w.Code)
	}
	if got := list(b.RefreshToken, http.StatusOK); len(got) != 1 {
		t.Fatal("revoking A disturbed B")
	}
}
