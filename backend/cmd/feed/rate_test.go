package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"chatnet/internal/authx"
	"github.com/redis/go-redis/v9"
)

func TestFeedRateLimitIntegration(t *testing.T) {
	addr := os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if addr == "" {
		t.Skip("set CHATNET_TEST_REDIS_ADDR for Redis rate limiting")
	}
	client := redis.NewClient(&redis.Options{Addr: addr})
	defer client.Close()
	if err := client.Ping(context.Background()).Err(); err != nil {
		t.Fatal(err)
	}
	secret := "feed-rate-test-secret"
	s := &server{redis: client}
	scope := fmt.Sprintf("test-%d", time.Now().UnixNano())
	handler := authx.Middleware(secret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.allowFeedWrite(w, r, scope, 1, time.Minute) {
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	for _, tc := range []struct {
		userID int64
		want   int
	}{
		{501, http.StatusNoContent},
		{501, http.StatusTooManyRequests},
		{502, http.StatusNoContent},
	} {
		token, err := authx.Sign(secret, tc.userID, "rateuser", "Rate User")
		if err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest(http.MethodPost, "/api/test-rate", nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatalf("user %d got %d want %d: %s", tc.userID, w.Code, tc.want, w.Body.String())
		}
		if w.Code == http.StatusTooManyRequests && w.Header().Get("Retry-After") == "" {
			t.Fatal("missing Retry-After for throttled write")
		}
	}
}
