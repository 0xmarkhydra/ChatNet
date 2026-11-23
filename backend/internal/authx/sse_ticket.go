package authx

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const eventTicketTTL = time.Minute

func eventTicketKey(ticket string) string {
	return fmt.Sprintf("chatnet:auth:sse-ticket:%s", ticket)
}

// IssueEventTicket stores an authenticated bearer for one EventSource connect.
// EventSource cannot set Authorization headers, so the URL carries only this
// short-lived, one-time opaque value.
func IssueEventTicket(ctx context.Context, rdb *redis.Client, bearer string) (string, error) {
	if rdb == nil || strings.TrimSpace(bearer) == "" {
		return "", errors.New("event ticket store unavailable")
	}
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate event ticket: %w", err)
	}
	ticket := base64.RawURLEncoding.EncodeToString(bytes)
	if err := rdb.Set(ctx, eventTicketKey(ticket), bearer, eventTicketTTL).Err(); err != nil {
		return "", fmt.Errorf("store event ticket: %w", err)
	}
	return ticket, nil
}

var consumeEventTicket = redis.NewScript(`
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value or ''
`)

// ConsumeEventTicket atomically reads and deletes a ticket. Replay returns no bearer.
func ConsumeEventTicket(ctx context.Context, rdb *redis.Client, ticket string) (string, error) {
	ticket = strings.TrimSpace(ticket)
	if rdb == nil || ticket == "" {
		return "", nil
	}
	value, err := consumeEventTicket.Run(ctx, rdb, []string{eventTicketKey(ticket)}).Result()
	if err != nil {
		return "", fmt.Errorf("consume event ticket: %w", err)
	}
	bearer, ok := value.(string)
	if !ok {
		return "", nil
	}
	return bearer, nil
}
