package authx

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestEventTicketIsSingleUse(t *testing.T) {
	addr := os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6379"
	}
	client := redis.NewClient(&redis.Options{Addr: addr, DialTimeout: time.Second, ReadTimeout: time.Second, WriteTimeout: time.Second})
	defer client.Close()
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		if os.Getenv("CHATNET_TEST_REDIS_ADDR") != "" {
			t.Fatalf("configured test Redis unavailable: %v", err)
		}
		t.Skip("set CHATNET_TEST_REDIS_ADDR or start local Redis to exercise event tickets")
	}
	ticket, err := IssueEventTicket(ctx, client, "bearer-token")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := ConsumeEventTicket(ctx, client, ticket); err != nil || got != "bearer-token" {
		t.Fatalf("first consume got %q, err %v", got, err)
	}
	if got, err := ConsumeEventTicket(ctx, client, ticket); err != nil || got != "" {
		t.Fatalf("ticket replay got %q, err %v", got, err)
	}
}
