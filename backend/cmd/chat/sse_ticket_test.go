package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"chatnet/internal/authx"
	"github.com/redis/go-redis/v9"
)

func TestEventTicketRateLimitIntegration(t *testing.T) {
	redisURL := os.Getenv("CHATNET_TEST_REDIS_URL")
	if redisURL == "" {
		t.Skip("set CHATNET_TEST_REDIS_URL for SSE ticket quota integration")
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(options)
	defer rdb.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatal(err)
	}

	userID := time.Now().UnixNano()
	bucket := time.Now().Unix() / int64(time.Minute/time.Second)
	key := fmt.Sprintf("chatnet:rate:events_ticket:user:%d:%d", bucket, userID)
	defer rdb.Del(context.Background(), key)
	if err := rdb.Set(ctx, key, eventTicketUserRateLimit, 2*time.Minute).Err(); err != nil {
		t.Fatal(err)
	}

	secret := "sse-ticket-quota-test-secret"
	token, err := authx.Sign(secret, userID, "ticket-test", "ticket-test")
	if err != nil {
		t.Fatal(err)
	}
	s := &server{redis: rdb, jwtSecret: secret}
	mux := http.NewServeMux()
	mux.Handle("POST /api/events/ticket", authx.Middleware(secret, http.HandlerFunc(s.eventTicket)))
	req := httptest.NewRequest(http.MethodPost, "/api/events/ticket", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusTooManyRequests || res.Header().Get("Retry-After") != strconv.Itoa(int(eventTicketRateLimitWindow.Seconds())) {
		t.Fatalf("event ticket quota got %d retry-after=%q: %s", res.Code, res.Header().Get("Retry-After"), res.Body.String())
	}
}
