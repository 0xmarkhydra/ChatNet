package authx

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5"
)

const testSessionID = "aa000000-0000-4000-8000-000000000001"

type sessionRowStub struct {
	active bool
	err    error
}

func (r sessionRowStub) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	*dest[0].(*bool) = r.active
	return nil
}

type sessionDBStub struct {
	active bool
	err    error
	calls  int
	id     string
	userID int64
}

func (s *sessionDBStub) QueryRow(_ context.Context, _ string, args ...any) pgx.Row {
	s.calls++
	s.id = args[0].(string)
	s.userID = args[1].(int64)
	return sessionRowStub{active: s.active, err: s.err}
}

func TestSessionMiddlewareChecksRevokedAccessTokens(t *testing.T) {
	token, err := Sign("secret", 23, "example", "Example", testSessionID)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		active bool
		dbErr  error
		status int
	}{
		{"active", true, nil, http.StatusNoContent},
		{"revoked", false, nil, http.StatusUnauthorized},
		{"database unavailable", false, errors.New("database down"), http.StatusServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := &sessionDBStub{active: tc.active, err: tc.dbErr}
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				claims, ok := ClaimsFromContext(r.Context())
				if !ok || claims.UserID != 23 || claims.SessionID != testSessionID {
					t.Error("missing validated claims")
				}
				w.WriteHeader(http.StatusNoContent)
			})
			req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			rec := httptest.NewRecorder()
			SessionMiddleware("secret", db, next).ServeHTTP(rec, req)
			if rec.Code != tc.status {
				t.Fatalf("status %d, expected %d", rec.Code, tc.status)
			}
			if db.calls != 1 || db.id != testSessionID || db.userID != 23 {
				t.Fatalf("session owner was not checked: %+v", db)
			}
		})
	}
}

func TestSessionMiddlewareRejectsTokensWithoutBackingSession(t *testing.T) {
	for _, sid := range []string{"", "not-a-uuid"} {
		token, err := Sign("secret", 23, "example", "Example", sid)
		if err != nil {
			t.Fatal(err)
		}
		db := &sessionDBStub{active: true}
		req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		SessionMiddleware("secret", db, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Error("invalid token reached endpoint")
		})).ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized || db.calls != 0 {
			t.Fatalf("invalid sid %q accepted: status=%d calls=%d", sid, rec.Code, db.calls)
		}
	}
}
