package authx

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

// SessionRevocationSignal is sent over the existing per-user Redis event channel.
const SessionRevocationSignal = "__session_revocation_check__"

const (
	// Positive cache entries are deliberately short-lived: a Redis outage during
	// revocation can at worst leave an old positive entry until this TTL.
	sessionCacheTTL = 10 * time.Second
	// An access JWT lives 24 hours. Preserve the deny marker beyond that lifetime
	// so any previously minted token stays revoked, even after a delayed retry.
	sessionRevokedTTL = 25 * time.Hour
)

func UserChannel(userID int64) string {
	return fmt.Sprintf("chatnet:user:%d", userID)
}

func sessionCacheKey(userID int64, sessionID string) string {
	return fmt.Sprintf("chatnet:auth:session:active:%d:%s", userID, sessionID)
}

func sessionRevokedKey(userID int64, sessionID string) string {
	return fmt.Sprintf("chatnet:auth:session:revoked:%d:%s", userID, sessionID)
}

var sessionIDRE = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// SessionQuery lets every service validate the same PostgreSQL-backed sessions.
type SessionQuery interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

// SessionActive fails closed if the session no longer exists or has expired.
func SessionActive(ctx context.Context, db SessionQuery, claims *Claims) (bool, error) {
	if claims == nil || claims.UserID <= 0 || !sessionIDRE.MatchString(claims.SessionID) {
		return false, nil
	}
	var active bool
	err := db.QueryRow(ctx, `
        SELECT EXISTS(
            SELECT 1 FROM auth_sessions
            WHERE session_id=$1::uuid AND user_id=$2 AND expires_at>NOW()
        )`, claims.SessionID, claims.UserID).Scan(&active)
	return active, err
}

// Cache an active PostgreSQL result only if it has not been revoked.
// The Lua script is atomic with the revocation tombstone, so an in-flight
// PostgreSQL lookup cannot repopulate an invalidated cache entry.
var cacheActiveSession = redis.NewScript(`
    if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
    redis.call('SET', KEYS[2], '1', 'PX', ARGV[1])
    return 1
`)

// SessionActiveCached uses Redis on the common path, PostgreSQL on cache misses
// or Redis errors, and never treats a Redis/DB outage as proof of a valid session.
func SessionActiveCached(ctx context.Context, db SessionQuery, rdb *redis.Client, claims *Claims) (bool, error) {
	if claims == nil || claims.UserID <= 0 || !sessionIDRE.MatchString(claims.SessionID) {
		return false, nil
	}
	if rdb == nil {
		return SessionActive(ctx, db, claims)
	}

	revoked := sessionRevokedKey(claims.UserID, claims.SessionID)
	active := sessionCacheKey(claims.UserID, claims.SessionID)
	states, err := rdb.MGet(ctx, revoked, active).Result()
	if err == nil {
		if states[0] != nil {
			return false, nil
		}
		if states[1] == "1" {
			return true, nil
		}
	}

	isActive, dbErr := SessionActive(ctx, db, claims)
	if dbErr != nil || !isActive {
		return isActive, dbErr
	}
	if err != nil {
		// Redis unavailable: rely on the authoritative DB for this request.
		return true, nil
	}
	cached, cacheErr := cacheActiveSession.Run(ctx, rdb, []string{revoked, active},
		sessionCacheTTL.Milliseconds()).Int()
	if cacheErr != nil {
		// Redis may have failed after PostgreSQL confirmed the session.
		return true, nil
	}
	return cached == 1, nil
}

// InvalidateSessions writes a per-session tombstone AND removes any positive
// cache entry in one Redis transaction. Never remove the tombstone on logout;
// only expiry can clear it, after the corresponding access JWT has expired.
func InvalidateSessions(ctx context.Context, rdb *redis.Client, userID int64, sessionIDs ...string) error {
	if rdb == nil || userID <= 0 || len(sessionIDs) == 0 {
		return nil
	}
	_, err := rdb.TxPipelined(ctx, func(p redis.Pipeliner) error {
		for _, id := range sessionIDs {
			if !sessionIDRE.MatchString(id) {
				return fmt.Errorf("invalid revoked session id")
			}
			p.Set(ctx, sessionRevokedKey(userID, id), "1", sessionRevokedTTL)
			p.Del(ctx, sessionCacheKey(userID, id))
		}
		return nil
	})
	return err
}

// SessionMiddleware checks PostgreSQL directly, primarily for tests and
// environments without Redis.
func SessionMiddleware(secret string, db SessionQuery, next http.Handler) http.Handler {
	return sessionMiddleware(secret, db, nil, next)
}

// CachedSessionMiddleware is used by all HTTP services for a shared revocation
// decision. A failed signature, missing sid or revoked session is always a 401.
func CachedSessionMiddleware(secret string, db SessionQuery, rdb *redis.Client, next http.Handler) http.Handler {
	return sessionMiddleware(secret, db, rdb, next)
}

func sessionMiddleware(secret string, db SessionQuery, rdb *redis.Client, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := Parse(secret, TokenFromRequest(r))
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		active, err := SessionActiveCached(r.Context(), db, rdb, claims)
		if err != nil {
			http.Error(w, "session unavailable", http.StatusServiceUnavailable)
			return
		}
		if !active {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsKey, claims)))
	})
}
