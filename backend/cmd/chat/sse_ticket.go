package main

import (
	"net/http"
	"strconv"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/ratelimit"
)

const (
	eventTicketRateLimitWindow = time.Minute
	eventTicketUserRateLimit  = 30
)

func (s *server) eventTicket(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok || claims == nil || claims.UserID <= 0 {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	allowed, _, err := (ratelimit.Limiter{Redis: s.redis}).Allow(
		r.Context(), "events_ticket:user", strconv.FormatInt(claims.UserID, 10), eventTicketUserRateLimit, eventTicketRateLimitWindow)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "rate limiter unavailable")
		return
	}
	if !allowed {
		w.Header().Set("Retry-After", strconv.Itoa(int(eventTicketRateLimitWindow.Seconds())))
		httpx.Error(w, http.StatusTooManyRequests, "too many realtime tickets; try again later")
		return
	}
	ticket, err := authx.IssueEventTicket(r.Context(), s.redis, authx.TokenFromRequest(r))
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "realtime unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"ticket": ticket})
}
