package database

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMigrateSerializesConcurrentServices(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("disposable PostgreSQL database required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "chatnet:schema-migrations"); err != nil {
		t.Fatal(err)
	}
	blockedCtx, stop := context.WithTimeout(ctx, 300*time.Millisecond)
	err = Migrate(blockedCtx, pool)
	stop()
	if err == nil {
		t.Fatal("migration did not wait for the lock")
	}
	if err = tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errors := make(chan error, 6)
	for i := 0; i < cap(errors); i++ {
		wg.Add(1)
		go func() { defer wg.Done(); errors <- Migrate(ctx, pool) }()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Error(err)
		}
	}
}
