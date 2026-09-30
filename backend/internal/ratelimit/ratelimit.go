package ratelimit

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Limiter struct {
	Redis *redis.Client
}

func (l Limiter) Allow(ctx context.Context, scope, subject string, limit int64, window time.Duration) (bool, int64, error) {
	if l.Redis == nil || limit <= 0 || window <= 0 {
		return true, 0, nil
	}
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "unknown"
	}

	bucket := time.Now().Unix() / int64(window.Seconds())
	key := fmt.Sprintf("chatnet:rate:%s:%d:%s", scope, bucket, subject)

	count, err := l.Redis.Incr(ctx, key).Result()
	if err != nil {
		return false, 0, err
	}
	if count == 1 {
		_ = l.Redis.Expire(ctx, key, window+30*time.Second).Err()
	}
	return count <= limit, count, nil
}
