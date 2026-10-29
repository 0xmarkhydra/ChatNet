package main

import (
	"chatnet/internal/database"
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"testing"
	"time"
)

func TestConversationCategoryDefaultsIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("local test database required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("default_categories_%d", time.Now().UnixNano())
	var id int64
	if err = db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!','Default Test') RETURNING id", name+"@example.invalid", name).Scan(&id); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", id)
	read := func() map[string]string {
		t.Helper()
		rows, err := db.Query(ctx, "SELECT name,color FROM conversation_categories WHERE user_id=$1", id)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		result := map[string]string{}
		for rows.Next() {
			var name, color string
			if err = rows.Scan(&name, &color); err != nil {
				t.Fatal(err)
			}
			result[name] = color
		}
		if rows.Err() != nil {
			t.Fatal(rows.Err())
		}
		return result
	}
	migrate := func() {
		t.Helper()
		if err := database.Migrate(ctx, db); err != nil {
			t.Fatal(err)
		}
	}
	defaults := read()
	for name, color := range map[string]string{"Gia đình": "pink", "Bạn bè": "blue", "Công việc": "orange", "Trả lời sau": "green"} {
		if defaults[name] != color {
			t.Fatalf("missing default %s: %+v", name, defaults)
		}
	}
	if len(defaults) != 4 {
		t.Fatalf("unexpected defaults: %+v", defaults)
	}
	db.Exec(ctx, "DELETE FROM conversation_categories WHERE user_id=$1 AND name='Trả lời sau'", id)
	migrate()
	if len(read()) != 3 {
		t.Fatal("deleted default was recreated")
	}
	// Simulate an existing account with its own spelling/color and no initialization marker.
	db.Exec(ctx, "DELETE FROM conversation_category_defaults WHERE user_id=$1", id)
	db.Exec(ctx, "DELETE FROM conversation_categories WHERE user_id=$1", id)
	db.Exec(ctx, "INSERT INTO conversation_categories(user_id,name,color) VALUES($1,'gia đình','slate')", id)
	migrate()
	defaults = read()
	if len(defaults) != 4 || defaults["gia đình"] != "slate" {
		t.Fatalf("backfill overwrote or duplicated existing tag: %+v", defaults)
	}
	migrate()
	if len(read()) != 4 {
		t.Fatal("repeat migration duplicated defaults")
	}
	// Backfill respects the same capacity as normal category creation.
	db.Exec(ctx, "DELETE FROM conversation_category_defaults WHERE user_id=$1", id)
	db.Exec(ctx, "DELETE FROM conversation_categories WHERE user_id=$1", id)
	for i := 0; i < 50; i++ {
		if _, err = db.Exec(ctx, "INSERT INTO conversation_categories(user_id,name,color) VALUES($1,$2,'blue')", id, fmt.Sprintf("Existing %d", i)); err != nil {
			t.Fatal(err)
		}
	}
	migrate()
	if len(read()) != 50 {
		t.Fatal("backfill exceeded quota or removed an existing tag")
	}
}
