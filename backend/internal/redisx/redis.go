package redisx

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/redis/go-redis/v9"
)

func Open(ctx context.Context) (*redis.Client, error) {
	var options *redis.Options
	var err error

	if rawURL := strings.TrimSpace(os.Getenv("REDIS_URL")); rawURL != "" {
		options, err = redis.ParseURL(rawURL)
		if err != nil {
			return nil, err
		}
	} else {
		addr := strings.TrimSpace(os.Getenv("REDIS_ADDR"))
		if addr == "" {
			addr = "localhost:6379"
		}
		options = &redis.Options{Addr: addr}
	}

	client := redis.NewClient(options)
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, errors.New("cannot connect to redis: " + err.Error())
	}
	return client, nil
}
