package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/ratelimit"
	"github.com/redis/go-redis/v9"
)

func TestNormalizeUIBundleRequest(t *testing.T) {
	body, err := normalizeUIBundleRequest(uiBundleRequest{Locale: " JA ", Version: "v1", Messages: map[string]string{"nav.chat": "Tin nhắn"}})
	if err != nil {
		t.Fatal(err)
	}
	if body.Locale != "ja" {
		t.Fatalf("locale=%q", body.Locale)
	}
	if _, err := normalizeUIBundleRequest(uiBundleRequest{Locale: "xx", Version: "v1", Messages: map[string]string{"a": "b"}}); err == nil {
		t.Fatal("unsupported locale should fail")
	}
}

func TestRequestIPUsesTrustedProxyChain(t *testing.T) {
	networks, err := httpx.ParseTrustedProxyCIDRs("127.0.0.0/8")
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodPost, "/api/i18n/bundle", nil)
	r.RemoteAddr = "127.0.0.1:4321"
	r.Header.Set("X-Forwarded-For", "198.51.100.23, 127.0.0.2")
	if got := requestIP(r, networks); got != "198.51.100.23" {
		t.Fatalf("requestIP() = %q, want forwarded client IP", got)
	}
}

func TestTranslateUIBundleRateLimitIntegration(t *testing.T) {
	redisURL := os.Getenv("CHATNET_TEST_REDIS_URL")
	if redisURL == "" {
		t.Skip("set CHATNET_TEST_REDIS_URL for translation quota integration")
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(options)
	defer rdb.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatal(err)
	}

	userID := time.Now().UnixNano()
	secret := "translation-quota-test-secret"
	token, err := authx.Sign(secret, userID, "quota-test", "quota-test")
	if err != nil {
		t.Fatal(err)
	}
	s := &server{redis: rdb, limiter: ratelimit.Limiter{Redis: rdb}, rateLimitEnabled: true}
	mux := http.NewServeMux()
	mux.Handle("POST /api/i18n/bundle", authx.Middleware(secret, http.HandlerFunc(s.translateUIBundle)))
	for attempt := int64(1); attempt <= translationUserRateLimit+1; attempt++ {
		req := httptest.NewRequest(http.MethodPost, "/api/i18n/bundle", strings.NewReader(
			`{"locale":"vi","version":"quota-test","messages":{"nav.chat":"Tin nhắn"}}`,
		))
		req.Header.Set("Authorization", "Bearer "+token)
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if attempt <= translationUserRateLimit && res.Code != http.StatusOK {
			t.Fatalf("request %d got %d: %s", attempt, res.Code, res.Body.String())
		}
		if attempt == translationUserRateLimit+1 {
			if res.Code != http.StatusTooManyRequests || res.Header().Get("Retry-After") != "60" {
				t.Fatalf("rate limit got %d retry-after=%q: %s", res.Code, res.Header().Get("Retry-After"), res.Body.String())
			}
		}
	}
	keys, err := rdb.Keys(ctx, fmt.Sprintf("chatnet:rate:translate:*:*:u:%d", userID)).Result()
	if err != nil {
		t.Fatal(err)
	}
	if len(keys) > 0 {
		if err := rdb.Del(ctx, keys...).Err(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestParseUIBundlePreservesKeysAndFallbacks(t *testing.T) {
	source := map[string]string{"nav.chat": "Tin nhắn", "nav.profile": "Cá nhân"}
	got, err := parseUIBundle("```json\n{\"nav.chat\":\"Messages\"}\n```", source)
	if err != nil {
		t.Fatal(err)
	}
	if got["nav.chat"] != "Messages" {
		t.Fatalf("translated value=%q", got["nav.chat"])
	}
	if got["nav.profile"] != "Cá nhân" {
		t.Fatalf("fallback=%q", got["nav.profile"])
	}
	if len(got) != len(source) {
		t.Fatalf("unexpected key count=%d", len(got))
	}
}

func TestUIBundleCacheKeyIsOrderIndependent(t *testing.T) {
	a := uiBundleRequest{Locale: "en", Version: "v1", Messages: map[string]string{"a": "Một", "b": "Hai"}}
	b := uiBundleRequest{Locale: "en", Version: "v1", Messages: map[string]string{"b": "Hai", "a": "Một"}}
	if uiBundleCacheKey(a) != uiBundleCacheKey(b) {
		t.Fatal("cache key must be stable")
	}
}

func TestTranslateUIBundleRejectsTrailingJSON(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/api/i18n/bundle", strings.NewReader(
		`{"locale":"vi","version":"v1","messages":{"nav.chat":"Tin nhắn"}} {}`,
	))
	w := httptest.NewRecorder()
	(&server{}).translateUIBundle(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status=%d, body=%s", w.Code, w.Body.String())
	}
}
