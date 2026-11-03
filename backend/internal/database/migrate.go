package database

import (
	"context"
	_ "embed"
	"fmt"

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

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return fmt.Errorf("postgres pool is nil")
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin migration transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	// Every service starts against the same database. Serialize DDL and seed work
	// so concurrent containers cannot create the same PostgreSQL type/trigger.
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "chatnet:schema-migrations"); err != nil {
		return fmt.Errorf("lock migrations: %w", err)
	}
	if _, err = tx.Exec(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	if _, err = tx.Exec(ctx, conversationCategoriesSQL); err != nil {
		return fmt.Errorf("apply conversation categories migration: %w", err)
	}
	if _, err = tx.Exec(ctx, defaultConversationCategoriesSQL); err != nil {
		return fmt.Errorf("apply default conversation categories migration: %w", err)
	}
	if _, err = tx.Exec(ctx, profileNotesSQL); err != nil {
		return fmt.Errorf("apply profile notes migration: %w", err)
	}
	if _, err = tx.Exec(ctx, groupGovernanceSQL); err != nil {
		return fmt.Errorf("apply group governance migration: %w", err)
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migrations: %w", err)
	}
	return nil
}
