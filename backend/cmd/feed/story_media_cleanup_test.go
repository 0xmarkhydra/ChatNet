package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

type fakeStoryMediaStore struct {
	failures map[string][]error
	attempts []string
	deleted  []string
}

func (s *fakeStoryMediaStore) Delete(_ context.Context, storageRef string) error {
	s.attempts = append(s.attempts, storageRef)
	if failures := s.failures[storageRef]; len(failures) > 0 {
		err := failures[0]
		s.failures[storageRef] = failures[1:]
		return err
	}
	s.deleted = append(s.deleted, storageRef)
	return nil
}

func TestStoryMediaCleanupSerializesReuseIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for story media cleanup integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}

	name := fmt.Sprintf("story_cleanup_%d", time.Now().UnixNano())
	var userID, oldStoryID int64
	if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
		VALUES($1,$2,'test',$2) RETURNING id`, name+"@example.invalid", name).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	storageRef := "story/integration/" + name + ".jpg"
	defer db.Exec(context.Background(), `DELETE FROM story_media_cleanup WHERE storage_ref=$1`, storageRef)
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, userID)
	if err := db.QueryRow(ctx, `INSERT INTO stories(user_id,storage_ref,original_name,content_type,size_bytes,kind)
		VALUES($1,$2,'story.jpg','image/jpeg',100,'image') RETURNING id`, userID, storageRef).Scan(&oldStoryID); err != nil {
		t.Fatal(err)
	}

	store := &fakeStoryMediaStore{failures: map[string][]error{
		storageRef: {errors.New("storage unavailable")},
	}}
	countRef := func(refs []string) int {
		count := 0
		for _, ref := range refs {
			if ref == storageRef {
				count++
			}
		}
		return count
	}
	s := &server{db: db, deleteStoryMedia: store.Delete}
	useTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer useTx.Rollback(ctx)
	pending, err := reserveStoryMediaUse(ctx, useTx, storageRef)
	if err != nil || pending {
		t.Fatalf("reserve new use: pending=%t err=%v", pending, err)
	}
	if _, err := useTx.Exec(ctx, `INSERT INTO stories(user_id,storage_ref,original_name,content_type,size_bytes,kind)
		VALUES($1,$2,'story-copy.jpg','image/jpeg',100,'image')`, userID, storageRef); err != nil {
		t.Fatal(err)
	}

	deleted := make(chan error, 1)
	finished := make(chan error, 1)
	go func() {
		cleanupTx, err := db.Begin(ctx)
		if err != nil {
			deleted <- err
			finished <- err
			return
		}
		defer cleanupTx.Rollback(ctx)
		if _, err := cleanupTx.Exec(ctx, "DELETE FROM stories WHERE id=$1", oldStoryID); err != nil {
			deleted <- err
			finished <- err
			return
		}
		deleted <- nil
		if err := s.enqueueStoryMediaCleanup(ctx, cleanupTx, storageRef); err != nil {
			finished <- err
			return
		}
		finished <- cleanupTx.Commit(ctx)
	}()
	if err := <-deleted; err != nil {
		t.Fatal(err)
	}
	if err := useTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-finished; err != nil {
		t.Fatal(err)
	}

	var cleanupJobs, liveStories int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM story_media_cleanup WHERE storage_ref=$1", storageRef).Scan(&cleanupJobs); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, "SELECT count(*) FROM stories WHERE storage_ref=$1", storageRef).Scan(&liveStories); err != nil {
		t.Fatal(err)
	}
	if cleanupJobs != 0 || liveStories != 1 {
		t.Fatalf("after concurrent reuse: cleanup jobs=%d live stories=%d", cleanupJobs, liveStories)
	}

	cleanupTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanupTx.Rollback(ctx)
	if _, err := cleanupTx.Exec(ctx, "DELETE FROM stories WHERE storage_ref=$1", storageRef); err != nil {
		t.Fatal(err)
	}
	if err := s.enqueueStoryMediaCleanup(ctx, cleanupTx, storageRef); err != nil {
		t.Fatal(err)
	}
	if err := cleanupTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	reserveTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer reserveTx.Rollback(ctx)
	pending, err = reserveStoryMediaUse(ctx, reserveTx, storageRef)
	if err != nil || !pending {
		t.Fatalf("reserve pending cleanup ref: pending=%t err=%v", pending, err)
	}
	var jobID int64
	if err := db.QueryRow(ctx, "SELECT id FROM story_media_cleanup WHERE storage_ref=$1", storageRef).Scan(&jobID); err != nil {
		t.Fatal(err)
	}
	if err := reserveTx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	s.sweepStoryMediaCleanup(ctx)
	if countRef(store.attempts) != 1 {
		t.Fatalf("first cleanup attempt = %v", store.attempts)
	}
	var attempts int
	var lockedUntil *time.Time
	var lastError string
	var availableInSeconds int
	if err := db.QueryRow(ctx, `SELECT attempts,locked_until,last_error,
		EXTRACT(EPOCH FROM (available_at-NOW()))::int FROM story_media_cleanup WHERE id=$1`, jobID).
		Scan(&attempts, &lockedUntil, &lastError, &availableInSeconds); err != nil {
		t.Fatal(err)
	}
	if attempts != 1 || lockedUntil != nil || lastError != "storage unavailable" || availableInSeconds < 299 {
		t.Fatalf("retry state attempts=%d locked=%v error=%q available_in=%d", attempts, lockedUntil, lastError, availableInSeconds)
	}
	if _, err := db.Exec(ctx, "UPDATE story_media_cleanup SET available_at=NOW() WHERE id=$1", jobID); err != nil {
		t.Fatal(err)
	}
	s.sweepStoryMediaCleanup(ctx)
	if countRef(store.attempts) != 2 || countRef(store.deleted) != 1 {
		t.Fatalf("cleanup retry attempts=%v successful deletions=%v", store.attempts, store.deleted)
	}
	var completedAt *time.Time
	if err := db.QueryRow(ctx, "SELECT completed_at FROM story_media_cleanup WHERE id=$1", jobID).Scan(&completedAt); err != nil {
		t.Fatal(err)
	}
	if completedAt == nil {
		t.Fatal("completed cleanup ref was not retained as reuse guard")
	}
	if _, err := db.Exec(ctx, "UPDATE story_media_cleanup SET completed_at=NOW()-INTERVAL '16 minutes' WHERE id=$1", jobID); err != nil {
		t.Fatal(err)
	}
	if err := s.purgeCompletedStoryMediaCleanup(ctx); err != nil {
		t.Fatal(err)
	}
	reserveTx, err = db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer reserveTx.Rollback(ctx)
	pending, err = reserveStoryMediaUse(ctx, reserveTx, storageRef)
	if err != nil || pending {
		t.Fatalf("expired cleanup guard: pending=%t err=%v", pending, err)
	}
}
