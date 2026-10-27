package authx

import (
	"context"
	"fmt"
	"net/http"
	"regexp"

	"github.com/jackc/pgx/v5"
)

// SessionRevocationSignal is sent over the existing per-user Redis event channel.
const SessionRevocationSignal = "__session_revocation_check__"

func UserChannel(userID int64) string {
	return fmt.Sprintf("chatnet:user:%d", userID)
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

// SessionMiddleware refuses a signed JWT immediately after its backing
// refresh session is revoked. A database outage never grants access.
func SessionMiddleware(secret string, db SessionQuery, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := Parse(secret, TokenFromRequest(r))
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		active, err := SessionActive(r.Context(), db, claims)
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
