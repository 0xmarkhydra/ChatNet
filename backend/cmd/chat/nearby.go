package main

import (
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"strconv"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/redis/go-redis/v9"
)

const (
	nearbyActiveTTL = 15 * time.Minute
	nearbyCacheTTL  = 7 * 24 * time.Hour
)

var nearbyKeys = []string{"chatnet:nearby:geo", "chatnet:nearby:active-expiry", "chatnet:nearby:cache-expiry"}

// Keep removal, renewal, cache pruning and radius lookup atomic across chat replicas.
// Active visibility expires after 15 minutes, while the last opted-in location is cached
// for longer so repeated scans still work. Manual disable removes both immediately.
var nearbyScript = redis.NewScript(`
local now = tonumber(redis.call('TIME')[1])

local expiredActive = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', now)
for _, id in ipairs(expiredActive) do
  redis.call('ZREM', KEYS[2], id)
end

local expiredCache = redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', now)
for _, id in ipairs(expiredCache) do
  redis.call('ZREM', KEYS[1], id)
  redis.call('ZREM', KEYS[2], id)
  redis.call('ZREM', KEYS[3], id)
end

if ARGV[1] == 'remove' then
  redis.call('ZREM', KEYS[1], ARGV[2])
  redis.call('ZREM', KEYS[2], ARGV[2])
  redis.call('ZREM', KEYS[3], ARGV[2])
elseif ARGV[1] == 'find' then
  redis.call('GEOADD', KEYS[1], ARGV[3], ARGV[4], ARGV[2])
  redis.call('ZADD', KEYS[2], now + 900, ARGV[2])
  redis.call('ZADD', KEYS[3], now + 604800, ARGV[2])
  redis.call('EXPIRE', KEYS[1], 604800)
  redis.call('EXPIRE', KEYS[2], 604800)
  redis.call('EXPIRE', KEYS[3], 604800)
  local nearby = redis.call('GEOSEARCH', KEYS[1], 'FROMMEMBER', ARGV[2],
    'BYRADIUS', ARGV[5], 'km', 'ASC', 'COUNT', 101, 'WITHDIST')
  local result = {}
  for _, match in ipairs(nearby) do
    table.insert(result, match[1])
    table.insert(result, match[2])
  end
  return result
end
return {}
`)

func validCoordinates(lat, lon float64) bool {
	return !math.IsNaN(lat) && !math.IsNaN(lon) &&
		lat >= -85.05112878 && lat <= 85.05112878 && lon >= -180 && lon <= 180
}

func validNearbyRadius(radiusKm float64) bool {
	return !math.IsNaN(radiusKm) && !math.IsInf(radiusKm, 0) &&
		radiusKm >= 1 && radiusKm <= 50
}

func parseNearbyMatches(found []string, currentUserID int64) ([]int64, map[int64]float64) {
	ids := make([]int64, 0, len(found)/2)
	distances := make(map[int64]float64, len(found)/2)
	for index := 0; index+1 < len(found); index += 2 {
		userID, idErr := strconv.ParseInt(found[index], 10, 64)
		distanceKm, distanceErr := strconv.ParseFloat(found[index+1], 64)
		if idErr == nil && distanceErr == nil && userID != currentUserID {
			ids = append(ids, userID)
			distances[userID] = math.Round(distanceKm*10) / 10
		}
	}
	return ids, distances
}

func (s *server) expireNearby(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cleanup, cancel := context.WithTimeout(ctx, 5*time.Second)
			_ = nearbyScript.Run(cleanup, s.redis, nearbyKeys, "prune").Err()
			cancel()
		}
	}
}

func (s *server) findNearby(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
		RadiusKm  *float64 `json:"radiusKm,omitempty"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || body.Latitude == nil || body.Longitude == nil ||
		!validCoordinates(*body.Latitude, *body.Longitude) || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid coordinates")
		return
	}
	radiusKm := 5.0
	if body.RadiusKm != nil {
		radiusKm = *body.RadiusKm
	}
	if !validNearbyRadius(radiusKm) {
		httpx.Error(w, http.StatusBadRequest, "invalid nearby radius")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	id := strconv.FormatInt(claims.UserID, 10)
	allowed, err := s.redis.SetNX(ctx, "chatnet:nearby:rate:"+id, "1", 10*time.Second).Result()
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
		return
	}
	if !allowed {
		w.Header().Set("Retry-After", "10")
		httpx.Error(w, http.StatusTooManyRequests, "try again in 10 seconds")
		return
	}
	now := time.Now()
	activeUntil := now.Add(nearbyActiveTTL)
	cacheUntil := now.Add(nearbyCacheTTL)
	found, err := nearbyScript.Run(
		ctx, s.redis, nearbyKeys, "find", id, *body.Longitude, *body.Latitude, radiusKm,
	).StringSlice()
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
		return
	}
	ids, distances := parseNearbyMatches(found, claims.UserID)
	users := make([]map[string]any, 0, len(ids))
	if len(ids) > 0 {
		rows, err := s.db.Query(ctx, "SELECT id,username,display_name FROM users WHERE id=ANY($1)", ids)
		if err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
			return
		}
		defer rows.Close()
		type nearbyProfile struct {
			username    string
			displayName string
		}
		profiles := make(map[int64]nearbyProfile, len(ids))
		for rows.Next() {
			var userID int64
			var profile nearbyProfile
			if err := rows.Scan(&userID, &profile.username, &profile.displayName); err != nil {
				httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
				return
			}
			profiles[userID] = profile
		}
		if rows.Err() != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
			return
		}
		for _, userID := range ids {
			profile, exists := profiles[userID]
			if !exists {
				continue
			}
			userIDString := strconv.FormatInt(userID, 10)
			cacheExpiry, err := s.redis.ZScore(ctx, nearbyKeys[2], userIDString).Result()
			if err == redis.Nil {
				continue
			}
			if err != nil {
				httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
				return
			}
			activeExpiry, err := s.redis.ZScore(ctx, nearbyKeys[1], userIDString).Result()
			nearbyActive := err == nil && activeExpiry > float64(now.Unix())
			if err != nil && err != redis.Nil {
				httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
				return
			}
			locationUpdatedAt := time.Unix(
				int64(cacheExpiry)-int64(nearbyCacheTTL/time.Second),
				0,
			).UTC()
			online, _ := s.redis.Exists(ctx, presenceKey(userID)).Result()
			users = append(users, map[string]any{
				"id": userID, "username": profile.username, "displayName": profile.displayName,
				"online": online > 0, "nearbyActive": nearbyActive,
				"distanceKm": distances[userID], "locationUpdatedAt": locationUpdatedAt,
			})
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"users": users, "expiresAt": activeUntil, "cacheExpiresAt": cacheUntil, "radiusKm": radiusKm,
	})
}

func (s *server) stopNearby(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := nearbyScript.Run(ctx, s.redis, nearbyKeys, "remove", claims.UserID).Err(); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
