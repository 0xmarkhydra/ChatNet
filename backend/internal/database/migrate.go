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

//go:embed migrations/005_community_channels.sql
var communityChannelsSQL string

//go:embed migrations/004_single_message_reaction.sql
var singleMessageReactionSQL string

//go:embed migrations/005_post_reactions.sql
var postReactionsSQL string

//go:embed migrations/006_group_activities.sql
var groupActivitiesSQL string

//go:embed migrations/007_group_activity_pins.sql
var groupActivityPinsSQL string

//go:embed migrations/005_chat_pins.sql
var chatPinsSQL string

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
	if _, err = tx.Exec(ctx, communityChannelsSQL); err != nil {
		return fmt.Errorf("apply community channels migration: %w", err)
	}
	if _, err = tx.Exec(ctx, singleMessageReactionSQL); err != nil {
		return fmt.Errorf("apply message reaction migration: %w", err)
	}
	if _, err = tx.Exec(ctx, postReactionsSQL); err != nil {
		return fmt.Errorf("apply post reaction migration: %w", err)
	}
	if _, err = tx.Exec(ctx, chatPinsSQL); err != nil {
		return fmt.Errorf("apply chat pins migration: %w", err)
	}
	if _, err = tx.Exec(ctx, groupActivitiesSQL); err != nil {
		return fmt.Errorf("apply group activities migration: %w", err)
	}
	if _, err = tx.Exec(ctx, groupActivityPinsSQL); err != nil {
		return fmt.Errorf("apply group activity pins migration: %w", err)
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migrations: %w", err)
	}
	return nil
}
