package authx

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
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

type sessionRaceRow struct {
	onScan func()
}

func (r sessionRaceRow) Scan(dest ...any) error {
	r.onScan()
	*dest[0].(*bool) = true
	return nil
}

type sessionRaceDB struct {
	onScan func()
}

func (r sessionRaceDB) QueryRow(context.Context, string, ...any) pgx.Row {
	return sessionRaceRow{onScan: r.onScan}
}

func TestSessionRedisCacheAndRevocation(t *testing.T) {
	addr := os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6379"
	}
	client := redis.NewClient(&redis.Options{Addr: addr, DialTimeout: time.Second, ReadTimeout: time.Second, WriteTimeout: time.Second})
	defer client.Close()
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		if os.Getenv("CHATNET_TEST_REDIS_ADDR") != "" {
			t.Fatalf("configured test Redis unavailable: %v", err)
		}
		t.Skip("set CHATNET_TEST_REDIS_ADDR or start local Redis to exercise session cache")
	}
	claims := &Claims{UserID: time.Now().UnixNano(), SessionID: testSessionID}
	activeKey := sessionCacheKey(claims.UserID, claims.SessionID)
	revokedKey := sessionRevokedKey(claims.UserID, claims.SessionID)
	defer client.Del(ctx, activeKey, revokedKey)

	db := &sessionDBStub{active: true}
	active, err := SessionActiveCached(ctx, db, client, claims)
	if err != nil || !active || db.calls != 1 {
		t.Fatalf("initial session not cached: active=%v err=%v dbcalls=%d", active, err, db.calls)
	}
	db.err = errors.New("database down")
	active, err = SessionActiveCached(ctx, db, client, claims)
	if err != nil || !active || db.calls != 1 {
		t.Fatalf("cache hit still queried PostgreSQL: active=%v err=%v dbcalls=%d", active, err, db.calls)
	}
	if err := InvalidateSessions(ctx, client, claims.UserID, claims.SessionID); err != nil {
		t.Fatal(err)
	}
	active, err = SessionActiveCached(ctx, db, client, claims)
	if err != nil || active || db.calls != 1 {
		t.Fatalf("revocation must override cached access: active=%v err=%v dbcalls=%d", active, err, db.calls)
	}
	if n := client.Exists(ctx, activeKey).Val(); n != 0 {
		t.Fatal("revocation left positive cache entry")
	}

	// The second user, even with an identical sid, must have separate cache keys.
	other := &Claims{UserID: claims.UserID + 1, SessionID: testSessionID}
	defer client.Del(ctx, sessionCacheKey(other.UserID, other.SessionID), sessionRevokedKey(other.UserID, other.SessionID))
	otherDB := &sessionDBStub{active: true}
	active, err = SessionActiveCached(ctx, otherDB, client, other)
	if err != nil || !active {
		t.Fatalf("another account was affected by revocation: %v %v", active, err)
	}

	// A DB query that overlaps a revocation must not refill the positive key.
	racing := &Claims{UserID: claims.UserID + 2, SessionID: testSessionID}
	defer client.Del(ctx, sessionCacheKey(racing.UserID, racing.SessionID), sessionRevokedKey(racing.UserID, racing.SessionID))
	raceDB := sessionRaceDB{onScan: func() {
		if err := InvalidateSessions(ctx, client, racing.UserID, racing.SessionID); err != nil {
			t.Fatal(err)
		}
	}}
	active, err = SessionActiveCached(ctx, raceDB, client, racing)
	if err != nil || active {
		t.Fatalf("racing cache fill resurrected revoked session: %v %v", active, err)
	}
	if client.Exists(ctx, sessionCacheKey(racing.UserID, racing.SessionID)).Val() != 0 {
		t.Fatal("race repopulated active cache after revocation")
	}

	// Redis failures must fall back to PostgreSQL, never trust a stale local cache.
	client.Close()
	offline := &sessionDBStub{active: false}
	active, err = SessionActiveCached(ctx, offline, client, other)
	if err != nil || active || offline.calls != 1 {
		t.Fatalf("Redis outage did not consult PostgreSQL: %v %v %d", active, err, offline.calls)
	}
	offline.err = errors.New("database unavailable")
	_, err = SessionActiveCached(ctx, offline, client, other)
	if err == nil {
		t.Fatal("simultaneous Redis/PostgreSQL failure must fail closed")
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
