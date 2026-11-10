package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"
)

// Allow time for offline drafts and retries before deleting unattached chat
// uploads. Storage deletion is opt-in because it is irreversible.
const chatOrphanRetention = 7 * 24 * time.Hour

func eligibleChatOrphan(modified, now time.Time) bool {
	return !modified.IsZero() && !modified.After(now) && now.Sub(modified) > chatOrphanRetention
}

func (s *server) cleanupOrphanChatMedia(ctx context.Context) {
	if s.storage == nil || !s.storage.Configured() ||
		!strings.EqualFold(strings.TrimSpace(os.Getenv("MEDIA_ORPHAN_CLEANUP_ENABLED")), "true") {
		return
	}
	// No delete at application startup; only after an interval, to keep boot safe.
	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			job, cancel := context.WithTimeout(ctx, 10*time.Minute)
			s.sweepOrphanChatMedia(job)
			cancel()
		}
	}
}

func (s *server) sweepOrphanChatMedia(ctx context.Context) {
	next := ""
	for page := 0; page < 100 && ctx.Err() == nil; page++ {
		objects, token, err := s.storage.ListChatObjects(ctx, next)
		if err != nil {
			log.Printf("chat media cleanup listing failed: %v", err)
			return
		}
		now := time.Now().UTC()
		for _, object := range objects {
			if !eligibleChatOrphan(object.LastModified, now) {
				continue
			}
			var inUse bool
			err := s.db.QueryRow(ctx, `SELECT EXISTS(
     SELECT 1 FROM message_attachments WHERE storage_ref=$1
   )`, object.StorageRef).Scan(&inUse)
			if err != nil {
				log.Printf("chat media cleanup policy check failed: %v", err)
				return // Database is the authority. Never delete on DB uncertainty.
			}
			if inUse {
				continue
			}
			if err := s.storage.Delete(ctx, object.StorageRef); err != nil {
				log.Printf("chat media cleanup delete failed: %v", err)
			}
		}
		if token == "" || token == next {
			return
		}
		next = token
	}
}
