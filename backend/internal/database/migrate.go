package database

import (
	"context"
	_ "embed"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schemaSQL string

//go:embed migrations/001_conversation_categories.sql
var conversationCategoriesSQL string

//go:embed migrations/002_default_conversation_categories.sql
var defaultConversationCategoriesSQL string

//go:embed migrations/003_profile_notes.sql
var profileNotesSQL string

//go:embed migrations/004_group_governance.sql
var groupGovernanceSQL string

//go:embed migrations/005_chat_pins.sql
var chatPinsSQL string

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return fmt.Errorf("postgres pool is nil")
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer conn.Release()
	// Service processes start simultaneously: the same DDL/seed scripts must not race.
	const migrationLockID int64 = 0x434841544e4554
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := conn.Exec(unlockCtx, "SELECT pg_advisory_unlock($1)", migrationLockID); err != nil {
			_ = conn.Conn().Close(context.Background())
		}
	}()
	if _, err := conn.Exec(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	if _, err := conn.Exec(ctx, conversationCategoriesSQL); err != nil {
		return fmt.Errorf("apply conversation categories migration: %w", err)
	}
	if _, err := conn.Exec(ctx, defaultConversationCategoriesSQL); err != nil {
		return fmt.Errorf("apply default conversation categories migration: %w", err)
	}
	if _, err := conn.Exec(ctx, profileNotesSQL); err != nil {
		return fmt.Errorf("apply profile notes migration: %w", err)
	}
	if _, err := conn.Exec(ctx, groupGovernanceSQL); err != nil {
		return fmt.Errorf("apply group governance migration: %w", err)
	}
	if _, err := conn.Exec(ctx, chatPinsSQL); err != nil {
		return fmt.Errorf("apply chat pins migration: %w", err)
	}
	return nil
}
