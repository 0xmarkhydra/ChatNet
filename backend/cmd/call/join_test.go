package main

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestJoinCallStateSerializesConcurrentCallEnd(t *testing.T) {
	databaseURL := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("isolated PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}

	ids := [2]int64{}
	for i := range ids {
		username := fmt.Sprintf("call_join_race_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `
			INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, username+"@example.invalid", username).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
	}
	defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1 OR id=$2", ids[0], ids[1])

	var conversationID int64
	if err := db.QueryRow(ctx, `
		INSERT INTO conversations(type,name,created_by)
		VALUES('group','join race',$1) RETURNING id`, ids[0]).Scan(&conversationID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO conversation_members(conversation_id,user_id,role)
		VALUES($1,$2,'owner'),($1,$3,'member')`, conversationID, ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}

	callID := fmt.Sprintf("call_join_%d", time.Now().UnixNano())
	roomName := fmt.Sprintf("room_join_%d", time.Now().UnixNano())
	if _, err := db.Exec(ctx, `
		INSERT INTO call_sessions(id,conversation_id,created_by,media_type,status,livekit_room)
		VALUES($1,$2,$3,'audio','ringing',$4)`, callID, conversationID, ids[0], roomName); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO call_participants(call_id,user_id,role,joined_at)
		VALUES($1,$2,'host',NOW()),($1,$3,'participant',NULL)`, callID, ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}

	endTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer endTx.Rollback(context.Background())
	var lockedID string
	if err := endTx.QueryRow(ctx, `SELECT id FROM call_sessions WHERE id=$1 FOR UPDATE`, callID).Scan(&lockedID); err != nil {
		t.Fatal(err)
	}

	result := make(chan error, 1)
	go func() {
		_, joinErr := (&server{db: db}).joinCallState(ctx, callSession{
			ID: callID, ConversationID: conversationID, CreatedBy: ids[0], Status: "ringing", RoomName: roomName,
		}, ids[1])
		result <- joinErr
	}()
	select {
	case err := <-result:
		t.Fatalf("join completed while call end held session lock: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	if _, err := endTx.Exec(ctx, `UPDATE call_sessions SET status='ended',ended_at=NOW() WHERE id=$1`, callID); err != nil {
		t.Fatal(err)
	}
	if _, err := endTx.Exec(ctx, `UPDATE call_participants SET left_at=NOW() WHERE call_id=$1`, callID); err != nil {
		t.Fatal(err)
	}
	if err := endTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	select {
	case err := <-result:
		if err != errCallNoLongerActive {
			t.Fatalf("join error=%v, want %v", err, errCallNoLongerActive)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("join did not observe ended call")
	}

	var joined, left bool
	if err := db.QueryRow(ctx, `
		SELECT joined_at IS NOT NULL,left_at IS NOT NULL
		FROM call_participants WHERE call_id=$1 AND user_id=$2`, callID, ids[1]).Scan(&joined, &left); err != nil {
		t.Fatal(err)
	}
	if joined || !left {
		t.Fatalf("participant state joined=%t left=%t, want joined=false,left=true", joined, left)
	}
}
