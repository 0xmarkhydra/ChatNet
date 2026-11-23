package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPublicCommunitySearchCursorIntegration(t *testing.T) {
	databaseURL := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL for disposable PostgreSQL integration")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}

	name := fmt.Sprintf("community_search_%d", time.Now().UnixNano())
	var ownerID int64
	if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
		VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.com", name).Scan(&ownerID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", ownerID)
	conversationIDs := make([]int64, 0, 4)
	insert := func(suffix, visibility string) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by,group_description,group_topic,group_visibility)
			VALUES('group',$1,$2,$3,$4,$5) RETURNING id`, name+" "+suffix, ownerID, "Description "+suffix, name, visibility).Scan(&id); err != nil {
			t.Fatal(err)
		}
		conversationIDs = append(conversationIDs, id)
		return id
	}
	first := insert("alpha", "public")
	second := insert("beta", "public")
	insert("private", "private")
	defer func() {
		for _, id := range conversationIDs {
			_, _ = db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", id)
		}
	}()

	token, err := authx.Sign("community-search-test", ownerID, name, name)
	if err != nil {
		t.Fatal(err)
	}
	handler := authx.Middleware("community-search-test", http.HandlerFunc((&server{db: db}).listPublicCommunities))
	searchPage := func(cursor string) (int, []communityProfile, *string) {
		t.Helper()
		path := "/api/groups/public?q=" + url.QueryEscape(name) + "&sort=relevance&limit=1"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		var response struct {
			Items      []communityProfile `json:"items"`
			NextCursor *string            `json:"nextCursor"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatalf("community search JSON: %v: %s", err, rec.Body.String())
		}
		return rec.Code, response.Items, response.NextCursor
	}
	status, page1, cursor := searchPage("")
	if status != http.StatusOK || len(page1) != 1 || page1[0].Visibility != "public" || cursor == nil {
		t.Fatalf("invalid first community page: status=%d items=%+v cursor=%v", status, page1, cursor)
	}
	status, page2, next := searchPage(*cursor)
	if status != http.StatusOK || len(page2) != 1 || page2[0].Visibility != "public" || next != nil || page1[0].ID == page2[0].ID {
		t.Fatalf("invalid second community page: status=%d items=%+v cursor=%v", status, page2, next)
	}
	if (page1[0].ID != first && page1[0].ID != second) || (page2[0].ID != first && page2[0].ID != second) {
		t.Fatal("private community leaked into public search")
	}
}
