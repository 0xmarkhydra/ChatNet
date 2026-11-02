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

//go:embed migrations/004_single_message_reaction.sql
var singleMessageReactionSQL string

//go:embed migrations/005_post_reactions.sql
var postReactionsSQL string

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return fmt.Errorf("postgres pool is nil")
	}
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	if _, err := pool.Exec(ctx, conversationCategoriesSQL); err != nil {
		return fmt.Errorf("apply conversation categories migration: %w", err)
	}
	if _, err := pool.Exec(ctx, defaultConversationCategoriesSQL); err != nil {
		return fmt.Errorf("apply default conversation categories migration: %w", err)
	}
	if _, err := pool.Exec(ctx, profileNotesSQL); err != nil {
		return fmt.Errorf("apply profile notes migration: %w", err)
	}
	if _, err := pool.Exec(ctx, singleMessageReactionSQL); err != nil {
		return fmt.Errorf("apply message reaction migration: %w", err)
	}
	if _, err := pool.Exec(ctx, postReactionsSQL); err != nil {
		return fmt.Errorf("apply post reaction migration: %w", err)
	}
	return nil
}
