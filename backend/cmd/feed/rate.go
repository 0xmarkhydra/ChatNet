package main

import (
	"net/http"
	"strconv"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/ratelimit"
)

// Production always initializes Redis. Nil is only used by validation-only
// tests, which deliberately exercise input rejection without infrastructure.
func (s *server) allowFeedWrite(w http.ResponseWriter, r *http.Request, scope string, limit int64, window time.Duration) bool {
	if s.redis == nil {
		return true
	}
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return false
	}
	allowed, _, err := (ratelimit.Limiter{Redis: s.redis}).Allow(
		r.Context(), "feed:"+scope, strconv.FormatInt(claims.UserID, 10), limit, window,
	)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot check rate limit")
		return false
	}
	if !allowed {
		w.Header().Set("Retry-After", strconv.FormatInt(int64(window.Seconds()), 10))
		httpx.Error(w, http.StatusTooManyRequests, "too many requests; try again later")
		return false
	}
	return true
}
