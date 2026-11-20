package database

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/019_scheduled_messages.sql
var scheduledMessagesSQL string

// MigrateScheduledMessages runs after the shared schema, before chat serves requests.
func MigrateScheduledMessages(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin scheduled messages migration: %w", err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", "chatnet:schema-migrations"); err != nil {
		return fmt.Errorf("lock scheduled messages migration: %w", err)
	}
	if _, err := tx.Exec(ctx, scheduledMessagesSQL); err != nil {
		return fmt.Errorf("apply scheduled messages migration: %w", err)
	}
	return tx.Commit(ctx)
}
