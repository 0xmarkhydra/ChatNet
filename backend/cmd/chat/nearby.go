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

const nearbyTTL = 15 * time.Minute

var nearbyKeys = []string{"chatnet:nearby:geo", "chatnet:nearby:expiry"}

// Keep removal, renewal and radius lookup atomic across chat replicas.
var nearbyScript = redis.NewScript(`
local now = tonumber(redis.call('TIME')[1])
local expired = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', now)
for _, id in ipairs(expired) do
  redis.call('ZREM', KEYS[1], id)
  redis.call('ZREM', KEYS[2], id)
end
if ARGV[1] == 'remove' then
  redis.call('ZREM', KEYS[1], ARGV[2])
  redis.call('ZREM', KEYS[2], ARGV[2])
elseif ARGV[1] == 'find' then
  redis.call('GEOADD', KEYS[1], ARGV[3], ARGV[4], ARGV[2])
  redis.call('ZADD', KEYS[2], now + 900, ARGV[2])
  redis.call('EXPIRE', KEYS[1], 900)
  redis.call('EXPIRE', KEYS[2], 900)
  local nearby = redis.call('GEOSEARCH', KEYS[1], 'FROMMEMBER', ARGV[2],
    'BYRADIUS', 5, 'km', 'ASC', 'COUNT', 51, 'WITHDIST')
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
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || body.Latitude == nil || body.Longitude == nil ||
		!validCoordinates(*body.Latitude, *body.Longitude) || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid coordinates")
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
	// ponytail: one fixed radius, short opt-in lease; no location history.
	expiresAt := time.Now().Add(nearbyTTL)
	found, err := nearbyScript.Run(ctx, s.redis, nearbyKeys, "find", id, *body.Longitude, *body.Latitude).StringSlice()
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
		return
	}
	ids, distances := parseNearbyMatches(found, claims.UserID)
	users := make([]map[string]any, 0, len(ids))
	if len(ids) > 0 {
		rows, err := s.db.Query(ctx, "SELECT id,username FROM users WHERE id=ANY($1)", ids)
		if err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
			return
		}
		defer rows.Close()
		usernames := make(map[int64]string, len(ids))
		for rows.Next() {
			var userID int64
			var username string
			if err := rows.Scan(&userID, &username); err != nil {
				httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
				return
			}
			usernames[userID] = username
		}
		if rows.Err() != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
			return
		}
		for _, userID := range ids {
			username, exists := usernames[userID]
			if !exists {
				continue
			}
			// Recheck consent after DB lookup so disabled/expired entries stay hidden.
			expiry, err := s.redis.ZScore(ctx, nearbyKeys[1], strconv.FormatInt(userID, 10)).Result()
			if err == redis.Nil {
				continue
			}
			if err != nil {
				httpx.Error(w, http.StatusServiceUnavailable, "nearby unavailable")
				return
			}
			if expiry <= float64(time.Now().Unix()) {
				continue
			}
			online, _ := s.redis.Exists(ctx, presenceKey(userID)).Result()
			users = append(users, map[string]any{
				"id": userID, "username": username, "online": online > 0,
				"distanceKm": distances[userID],
			})
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"users": users, "expiresAt": expiresAt})
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
