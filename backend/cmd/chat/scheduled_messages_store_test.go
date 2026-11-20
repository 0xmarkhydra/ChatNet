package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"chatnet/internal/authx"
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
	for range 2 {
		if err := database.MigrateScheduledMessages(ctx, db); err != nil {
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
	makeDue := func(id int64) {
		mustExec("UPDATE scheduled_messages SET send_at=NOW()-INTERVAL '1 second' WHERE id=$1", id)
	}
	checkState := func(id int64, want string) {
		t.Helper()
		m, err := scanScheduled(db.QueryRow(ctx, "SELECT "+scheduledColumns+" FROM scheduled_messages WHERE id=$1", id))
		if err != nil || m.State != want || m.Text != nil || (want == "sent") != (m.MessageID != nil) {
			t.Fatalf("id %d state want %s got %s, message link=%v, err=%v", id, want, m.State, m.MessageID != nil, err)
		}
	}

	t.Run("HTTP queue is private and validates the request", func(t *testing.T) {
		mux := http.NewServeMux()
		const queue = "/api/conversations/{id}/scheduled-messages"
		mux.Handle("POST "+queue, authx.Middleware("test", http.HandlerFunc(s.scheduleMessage)))
		mux.Handle("GET "+queue, authx.Middleware("test", http.HandlerFunc(s.listScheduledMessages)))
		mux.Handle("PATCH "+queue+"/{scheduleId}", authx.Middleware("test", http.HandlerFunc(s.moveScheduledMessage)))
		mux.Handle("DELETE "+queue+"/{scheduleId}", authx.Middleware("test", http.HandlerFunc(s.removeScheduledMessage)))
		req := func(method string, suffix string, body string, user int64, want int) *httptest.ResponseRecorder {
			t.Helper()
			r := httptest.NewRequest(method, fmt.Sprintf("/api/conversations/%d/scheduled-messages%s", room, suffix), strings.NewReader(body))
			if user != 0 {
				token, err := authx.Sign("test", user, "schedule-user", "Schedule User")
				if err != nil {
					t.Fatal(err)
				}
				r.Header.Set("Authorization", "Bearer "+token)
			}
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != want {
				t.Fatalf("%s as %d returned %d, want %d: %s", method, user, w.Code, want, w.Body)
			}
			return w
		}
		req("GET", "", "", 0, http.StatusUnauthorized)
		req("GET", "", "", outsider, http.StatusForbidden)
		req("POST", "", `{"attachments":[]}`, a, http.StatusBadRequest)
		w := req("POST", "", fmt.Sprintf(`{"text":"private queue body","clientId":"http-job","sendAt":%q}`, when.Format(time.RFC3339Nano)), a, http.StatusCreated)
		var job scheduledMessage
		if err := json.Unmarshal(w.Body.Bytes(), &job); err != nil || job.ID == 0 {
			t.Fatalf("invalid scheduling response: %v", err)
		}
		if got := req("GET", "", "", b, http.StatusOK); strings.TrimSpace(got.Body.String()) != "[]" {
			t.Fatal("another member must not see the queue")
		}
		if got := req("GET", "", "", a, http.StatusOK); !strings.Contains(got.Body.String(), "private queue body") || got.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("owner must see the queue and response must not be cached")
		}
		item := fmt.Sprintf("/%d", job.ID)
		reschedule := fmt.Sprintf(`{"sendAt":%q}`, when.Add(time.Hour).Format(time.RFC3339Nano))
		req("PATCH", item, reschedule, b, http.StatusNotFound)
		req("PATCH", item, reschedule, a, http.StatusOK)
		req("DELETE", item, "", b, http.StatusNotFound)
		req("DELETE", item, "", a, http.StatusNoContent)
		req("DELETE", item, "", a, http.StatusNoContent)
	})

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

	t.Run("deleted group channel cannot receive a scheduled message", func(t *testing.T) {
		var group, channel int64
		if err := db.QueryRow(ctx, "INSERT INTO conversations(type,created_by) VALUES('group',$1) RETURNING id", a).Scan(&group); err != nil {
			t.Fatal(err)
		}
		mustExec("INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", group, a)
		if err := db.QueryRow(ctx, "INSERT INTO group_channels(conversation_id,name,created_by) VALUES($1,$2,$3) RETURNING id", group, "scheduled-test", a).Scan(&channel); err != nil {
			t.Fatal(err)
		}
		queued, err := s.createScheduledMessage(ctx, group, a, scheduleMessageInput{
			Text: "must not send to deleted channel", SendAt: when, ClientID: "deleted-channel", Channel: channel,
		})
		if err != nil {
			t.Fatal(err)
		}
		mustExec("UPDATE group_channels SET deleted_at=NOW() WHERE id=$1", channel)
		if _, err := s.createScheduledMessage(ctx, group, a, scheduleMessageInput{
			Text: "new schedule into deleted channel", SendAt: when, ClientID: "deleted-channel-new", Channel: channel,
		}); !errors.Is(err, errScheduledForbidden) {
			t.Fatalf("new schedules to deleted channels must be rejected: %v", err)
		}
		if _, err := s.rescheduleMessage(ctx, group, a, queued.ID, when.Add(time.Hour)); !errors.Is(err, errScheduledForbidden) {
			t.Fatalf("rescheduling for a deleted channel must be rejected: %v", err)
		}
		makeDue(queued.ID)
		id, _, handled, err := s.dispatchScheduledMessage(ctx)
		if err != nil || id != 0 || !handled {
			t.Fatalf("deleted channel must not receive a scheduled message: id=%d handled=%v err=%v", id, handled, err)
		}
		checkState(queued.ID, "failed")
		var delivered int
		if err := db.QueryRow(ctx, "SELECT count(*) FROM messages WHERE conversation_id=$1", group).Scan(&delivered); err != nil || delivered != 0 {
			t.Fatalf("deleted channel received %d messages: %v", delivered, err)
		}
	})
	var count int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM messages WHERE conversation_id=$1", room).Scan(&count); err != nil || count != 1 {
		t.Fatalf("expected one delivered message, got %d, %v", count, err)
	}
}
