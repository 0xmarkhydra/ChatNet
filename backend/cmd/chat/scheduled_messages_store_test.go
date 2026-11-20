package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"chatnet/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestScheduledMessageStoreIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_SCHEDULED_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires the isolated SOCCO-89 CI database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	// The proposed migration is tested before registration with the shared migrator.
	ddl, err := os.ReadFile("../../internal/database/migrations/019_scheduled_messages.sql")
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := db.Exec(ctx, string(ddl)); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "0")
	t.Setenv("CHATNET_E2EE_AUTO_DEFAULT", "0")
	s := &server{db: db}
	mustExec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	var users [3]int64
	stamp := time.Now().UnixNano()
	for i := range users {
		name := fmt.Sprintf("scheduled-%d-%d", stamp, i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.com", name).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
	}
	var room int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,direct_key,created_by)
		VALUES('direct',$1,$2) RETURNING id`, directKey(users[0], users[1]), users[0]).Scan(&room); err != nil {
		t.Fatal(err)
	}
	for _, id := range users[:2] {
		mustExec("INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", room, id)
	}
	a, b, outsider := users[0], users[1], users[2]
	when := time.Now().Add(30 * time.Minute)
	create := func(id string) scheduledMessage {
		t.Helper()
		m, err := s.createScheduledMessage(ctx, room, a, scheduleMessageInput{Text: "message", SendAt: when, ClientID: id})
		if err != nil {
			t.Fatal(err)
		}
		return m
	}
	makeDue := func(id int64) { mustExec("UPDATE scheduled_messages SET send_at=NOW()-INTERVAL '1 second' WHERE id=$1", id) }
	checkState := func(id int64, want string) {
		t.Helper()
		m, err := scanScheduled(db.QueryRow(ctx, "SELECT "+scheduledColumns+" FROM scheduled_messages WHERE id=$1", id))
		if err != nil || m.State != want || m.Text != nil || (want == "sent") != (m.MessageID != nil) {
			t.Fatalf("id %d state want %s got %s, message link=%v, err=%v", id, want, m.State, m.MessageID != nil, err)
		}
	}

	job := create("delivery-retry")
	if _, err := s.cancelScheduledMessage(ctx, room, outsider, job.ID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("another user must not cancel the schedule, got %v", err)
	}
	changed, err := s.rescheduleMessage(ctx, room, a, job.ID, when.Add(time.Hour))
	if err != nil || !changed.SendAt.Equal(when.Add(time.Hour).Truncate(time.Microsecond)) {
		t.Fatalf("reschedule failed: %v", err)
	}
	if got := create("delivery-retry"); got.ID != job.ID || !got.SendAt.Equal(changed.SendAt) {
		t.Fatal("creation retry did not return the original job, with the new time")
	}
	if _, err := s.createScheduledMessage(ctx, room, a, scheduleMessageInput{
		Text: "different", SendAt: when, ClientID: "delivery-retry",
	}); !errors.Is(err, errScheduledConflict) {
		t.Fatalf("payload mismatch must conflict, got %v", err)
	}
	if id, _, ok, err := s.dispatchScheduledMessage(ctx); id != 0 || ok || err != nil {
		t.Fatalf("a job cannot send early, got id=%d worked=%v err=%v", id, ok, err)
	}
	makeDue(job.ID)
	var wg sync.WaitGroup
	outcomes := make(chan int64, 4)
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			id, _, _, err := s.dispatchScheduledMessage(ctx)
			if err != nil {
				t.Error(err)
			}
			outcomes <- id
		}()
	}
	wg.Wait()
	close(outcomes)
	emitted := 0
	for id := range outcomes {
		if id != 0 {
			emitted++
		}
	}
	if emitted != 1 {
		t.Fatalf("only one worker can send, got %d", emitted)
	}
	checkState(job.ID, "sent")

	stopped := create("cancel")
	makeDue(stopped.ID)
	if _, err := s.cancelScheduledMessage(ctx, room, a, stopped.ID); err != nil {
		t.Fatal(err)
	}
	checkState(stopped.ID, "cancelled")
	encrypted := create("encrypted-later")
	makeDue(encrypted.ID)
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "1")
	t.Setenv("CHATNET_E2EE_AUTO_DEFAULT", "1")
	if id, _, ok, err := s.dispatchScheduledMessage(ctx); id != 0 || !ok || err != nil {
		t.Fatalf("encrypted conversation must stop a pending job, got id=%d handled=%v err=%v", id, ok, err)
	}
	checkState(encrypted.ID, "failed")
	t.Setenv("CHATNET_E2EE_AUTO_DEFAULT", "0")
	blocked := create("blocked-later")
	makeDue(blocked.ID)
	mustExec("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", b, a)
	if id, _, ok, err := s.dispatchScheduledMessage(ctx); id != 0 || !ok || err != nil {
		t.Fatalf("new block must stop a pending job, got id=%d handled=%v err=%v", id, ok, err)
	}
	checkState(blocked.ID, "failed")
	var count int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM messages WHERE conversation_id=$1", room).Scan(&count); err != nil || count != 1 {
		t.Fatalf("expected one delivered message, got %d, %v", count, err)
	}
}
