package main

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"github.com/redis/go-redis/v9"
)

func TestNearbyValidation(t *testing.T) {
	for _, tc := range []struct {
		lat, lon float64
		want     bool
	}{
		{0, 0, true}, {10.77, 106.69, true}, {-85.05112878, 180, true},
		{90, 0, false}, {0, 181, false}, {math.NaN(), 0, false},
		{0, math.Inf(1), false},
	} {
		if validCoordinates(tc.lat, tc.lon) != tc.want {
			t.Fatalf("unexpected validation for %v,%v", tc.lat, tc.lon)
		}
	}
	s := &server{}
	token, err := authx.Sign("test", 42, "viewer", "Viewer")
	if err != nil {
		t.Fatal(err)
	}
	handler := authx.Middleware("test", http.HandlerFunc(s.findNearby))
	for _, body := range []string{
		`{}`, `{"latitude":null,"longitude":0}`, `{"latitude":0}`,
		`{"latitude":91,"longitude":0}`, `{"latitude":0,"longitude":181}`,
		`{"latitude":0,"longitude":0,"radiusKm":0}`, `{"latitude":0,"longitude":0,"radiusKm":51}`,
		`{"latitude":0,"longitude":0,"userId":3}`, `{"latitude":0,"longitude":0} {}`,
		`{"latitude":"0","longitude":0}`, strings.Repeat(" ", 1025),
	} {
		r := httptest.NewRequest("POST", "/api/users/nearby", strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("%s: got %d", body, w.Code)
		}
	}
	for _, endpoint := range []http.HandlerFunc{s.findNearby, s.stopNearby} {
		w := httptest.NewRecorder()
		authx.Middleware("test", endpoint).ServeHTTP(w, httptest.NewRequest("POST", "/api/users/nearby", nil))
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("unauthenticated nearby returned %d", w.Code)
		}
	}
}

func TestParseNearbyMatches(t *testing.T) {
	ids, distances := parseNearbyMatches(
		[]string{"42", "0.0000", "7", "1.26", "bad-id", "2.0", "8", "bad-distance", "9"},
		42,
	)
	if !reflect.DeepEqual(ids, []int64{7}) || distances[7] != 1.3 {
		t.Fatalf("unexpected nearby matches: ids=%v distances=%v", ids, distances)
	}
}

func TestNearbyRedisIntegration(t *testing.T) {
	addr := os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if addr == "" {
		t.Skip("set CHATNET_TEST_REDIS_ADDR for geospatial integration test")
	}
	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{Addr: addr})
	defer rdb.Close()
	prefix := "chatnet:test:nearby:" + t.Name() + ":" + time.Now().Format("150405.000000000")
	keys := []string{prefix + ":geo", prefix + ":active-expiry", prefix + ":cache-expiry"}
	defer rdb.Del(ctx, keys...)
	find := func(id string, lon, lat, radiusKm float64) []string {
		t.Helper()
		result, err := nearbyScript.Run(ctx, rdb, keys, "find", id, lon, lat, radiusKm).StringSlice()
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	find("1", 106.69, 10.77, 5)
	find("2", 106.70, 10.77, 5)
	find("3", 105.83, 21.02, 5)
	if got := find("1", 106.69, 10.77, 5); len(got) != 4 || got[0] != "1" || got[2] != "2" {
		t.Fatalf("radius mismatch: %v", got)
	}

	// Active status may expire, but the opted-in cached location remains discoverable.
	if err := rdb.ZAdd(ctx, keys[1], redis.Z{Score: 1, Member: "2"}).Err(); err != nil {
		t.Fatal(err)
	}
	if got := find("1", 106.69, 10.77, 5); len(got) != 4 || got[2] != "2" {
		t.Fatalf("cached location disappeared with active expiry: %v", got)
	}
	if _, err := rdb.ZScore(ctx, keys[0], "2").Result(); err != nil {
		t.Fatalf("cached coordinate removed too early: %v", err)
	}

	// Cache expiry removes the stale location entirely.
	if err := rdb.ZAdd(ctx, keys[2], redis.Z{Score: 1, Member: "2"}).Err(); err != nil {
		t.Fatal(err)
	}
	if got := find("1", 106.69, 10.77, 5); len(got) != 2 || got[0] != "1" {
		t.Fatalf("expired cache still visible: %v", got)
	}
	if _, err := rdb.ZScore(ctx, keys[0], "2").Result(); err != redis.Nil {
		t.Fatalf("expired cached coordinate retained: %v", err)
	}

	find("2", 106.70, 10.77, 5)
	if err := nearbyScript.Run(ctx, rdb, keys, "remove", "2").Err(); err != nil {
		t.Fatal(err)
	}
	if got := find("1", 106.69, 10.77, 5); len(got) != 2 || got[0] != "1" {
		t.Fatalf("disabled user visible: %v", got)
	}
	find("2", 106.70, 10.77, 5)
	find("2", 105.83, 21.02, 5)
	if got := find("1", 106.69, 10.77, 5); len(got) != 2 || got[0] != "1" {
		t.Fatalf("old location retained: %v", got)
	}
	for _, key := range keys {
		if ttl := rdb.TTL(ctx, key).Val(); ttl <= 0 || ttl > nearbyCacheTTL {
			t.Fatalf("missing bounded cache TTL: %v", ttl)
		}
	}
	originalKeys := nearbyKeys
	nearbyKeys = []string{prefix + ":api:geo", prefix + ":api:active-expiry", prefix + ":api:cache-expiry"}
	defer func() { nearbyKeys = originalKeys }()
	defer rdb.Del(ctx, nearbyKeys...)
	userID := time.Now().UnixNano()
	rateKey := "chatnet:nearby:rate:" + strconv.FormatInt(userID, 10)
	defer rdb.Del(ctx, rateKey)
	token, err := authx.Sign("test", userID, "viewer", "Viewer")
	if err != nil {
		t.Fatal(err)
	}
	s := &server{redis: rdb}
	request := func(handler http.HandlerFunc, method, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/users/nearby", strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		authx.Middleware("test", handler).ServeHTTP(w, r)
		return w
	}
	w := request(s.findNearby, "POST", `{"latitude":10.77,"longitude":106.69}`)
	var result struct {
		Users          []map[string]any `json:"users"`
		ExpiresAt      time.Time        `json:"expiresAt"`
		CacheExpiresAt time.Time        `json:"cacheExpiresAt"`
		RadiusKm       float64          `json:"radiusKm"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &result) != nil || len(result.Users) != 0 ||
		!result.ExpiresAt.After(time.Now()) || !result.CacheExpiresAt.After(result.ExpiresAt) ||
		result.RadiusKm != 5 || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("invalid self-only response: %d %s", w.Code, w.Body.String())
	}
	w = request(s.findNearby, "POST", `{"latitude":10.77,"longitude":106.69}`)
	if w.Code != 429 || w.Header().Get("Retry-After") != "10" {
		t.Fatalf("rate limit failed: %d", w.Code)
	}
	w = request(s.stopNearby, "DELETE", "")
	if w.Code != 200 ||
		rdb.ZCard(ctx, nearbyKeys[0]).Val() != 0 ||
		rdb.ZCard(ctx, nearbyKeys[1]).Val() != 0 ||
		rdb.ZCard(ctx, nearbyKeys[2]).Val() != 0 {
		t.Fatalf("disable failed: %d %s", w.Code, w.Body.String())
	}
}
