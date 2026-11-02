package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCallBlockDirectMembershipIntegration(t *testing.T) {
	uri := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("isolated PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	ids := [3]int64{}
	for i := range ids {
		username := fmt.Sprintf("call_block_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
            VALUES($1,$2,'!',$2) RETURNING id`, username+"@example.invalid", username).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
	}
	var directID, groupID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,direct_key,created_by)
         VALUES('direct',$1,$2) RETURNING id`, fmt.Sprintf("%d:%d", min(ids[0], ids[1]), max(ids[0], ids[1])), ids[0]).Scan(&directID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", directID)
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by)
         VALUES('group','everyone',$1) RETURNING id`, ids[2]).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", groupID)
	for _, id := range ids {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,'member')`, groupID, id); err != nil {
			t.Fatal(err)
		}
		if id != ids[2] {
			if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,'member')`, directID, id); err != nil {
				t.Fatal(err)
			}
		}
	}
	if _, err := s.membership(ctx, directID, ids[0]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	for _, id := range ids[:2] {
		if _, err := s.membership(ctx, directID, id); !errors.Is(err, pgx.ErrNoRows) {
			t.Fatalf("blocked direct call membership for %d: expected not found, got %v", id, err)
		}
		member, err := s.membership(ctx, groupID, id)
		if err != nil || member.ConversationType != "group" {
			t.Fatalf("group membership should persist: %+v %v", member, err)
		}
	}
	blocked, err := s.blockedPair(ctx, ids[1], ids[0])
	if err != nil || !blocked {
		t.Fatalf("block direction should be symmetric: %v %v", blocked, err)
	}
	if _, err := db.Exec(ctx, `DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	if _, err := s.membership(ctx, directID, ids[1]); err != nil {
		t.Fatal(err)
	}
}

func TestCurrentCallsExcludeBlockedDirect(t *testing.T) {
	for _, fragment := range []string{"c.type <> 'direct'", "user_blocks", "other.user_id<>$1"} {
		if !strings.Contains(currentCallsSQL, fragment) {
			t.Fatalf("currentCallsSQL does not enforce block: %s", fragment)
		}
	}
}
