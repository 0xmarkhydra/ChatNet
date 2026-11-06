package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostSearchRejectsOversizedQuery(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/posts?q="+url.QueryEscape(strings.Repeat("ệ", 121)), nil)
	res := httptest.NewRecorder()
	(&server{}).list(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("oversized query returned %d, want 400", res.Code)
	}
}

// Uses a disposable PostgreSQL database when CHATNET_TEST_DATABASE_URL is set.
func TestPostSearchGlobalCursorAndPrivacyIntegration(t *testing.T) {
	uri := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if uri == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}

	prefix := fmt.Sprintf("search_%d", time.Now().UnixNano())
	ids := make([]int64, 3)
	names := make([]string, 3)
	for i := range ids {
		names[i] = fmt.Sprintf("%s_%d", prefix, i)
		label := fmt.Sprintf("Author %s %d", prefix, i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
            VALUES($1,$2,'test',$3) RETURNING id`,
			names[i]+"@example.invalid", names[i], label).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		id := ids[i]
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
	}

	// Viewer 0 can see author 1's public posts, but not private, friends-only, or blocked posts.
	insert := func(author int, content, visibility string) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility)
            VALUES($1,$2,$3) RETURNING id`, ids[author], content, visibility).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	needle := "needle" + prefix
	first := insert(1, "Public "+needle+" oldest", "public")
	second := insert(1, "Public "+needle+" middle", "public")
	third := insert(1, "Public "+needle+" newest", "public")
	privateID := insert(1, "Private "+needle, "private")
	friendsID := insert(1, "Friends "+needle, "friends")
	blockedID := insert(2, "Blocked "+needle, "public")
	literalID := insert(1, "literal%_tag"+prefix, "public")
	unrelatedID := insert(1, "unrelated public", "public")
	if _, err := db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", ids[0], ids[2]); err != nil {
		t.Fatal(err)
	}

	token, err := authx.Sign("search-test", ids[0], names[0], names[0])
	if err != nil {
		t.Fatal(err)
	}
	handler := authx.Middleware("search-test", http.HandlerFunc((&server{db: db}).list))
	search := func(q string, before int64, extra string) []post {
		t.Helper()
		path := "/api/posts?limit=2&q=" + url.QueryEscape(q) + extra
		if before > 0 {
			path += fmt.Sprintf("&before=%d", before)
		}
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s: %d %s", path, rec.Code, rec.Body.String())
		}
		var result []post
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}

	// Search has to paginate all eligible server rows, not only a client's first page.
	page1 := search(needle, 0, "")
	if len(page1) != 2 || page1[0].ID != third || page1[1].ID != second {
		t.Fatalf("incorrect first page: %+v", page1)
	}
	page2 := search(needle, page1[len(page1)-1].ID, "")
	if len(page2) != 1 || page2[0].ID != first {
		t.Fatalf("incorrect second page: %+v", page2)
	}
	if rest := search(needle, first, ""); len(rest) != 0 {
		t.Fatalf("search cursor repeated results: %+v", rest)
	}
	for _, post := range append(page1, page2...) {
		if post.ID == privateID || post.ID == friendsID || post.ID == blockedID {
			t.Fatalf("hidden post leaked: %d", post.ID)
		}
	}
	authorPage := search(names[1], 0, "")
	if len(authorPage) != 2 || authorPage[0].ID != unrelatedID || authorPage[1].ID != literalID {
		t.Fatalf("username search failed: %+v", authorPage)
	}
	displayPage := search("Author "+prefix+" 1", 0, "")
	if len(displayPage) != 2 || displayPage[0].ID != unrelatedID || displayPage[1].ID != literalID {
		t.Fatalf("display-name search failed: %+v", displayPage)
	}
	wildcard := search("%_tag"+prefix, 0, "")
	if len(wildcard) != 1 || wildcard[0].ID != literalID {
		t.Fatalf("LIKE characters were not matched literally: %+v", wildcard)
	}

	accentID := insert(1, "Bài viết tìm kiếm "+prefix, "public")
	if result := search("bai viet tim kiem "+prefix, 0, ""); len(result) != 1 || result[0].ID != accentID {
		t.Fatalf("accent-insensitive post search failed: %+v", result)
	}
	if _, err := db.Exec(ctx, "UPDATE users SET display_name=$2 WHERE id=$1", ids[1], "Tác giả Nguyễn Việt"); err != nil {
		t.Fatal(err)
	}
	if result := search("tac gia nguyen viet", 0, ""); len(result) != 2 || result[0].ID != accentID {
		t.Fatalf("accent-insensitive author search failed: %+v", result)
	}

	if _, err := db.Exec(ctx, `INSERT INTO saved_posts(user_id,post_id) VALUES($1,$2)`, ids[0], first); err != nil {
		t.Fatal(err)
	}
	saved := search(needle, 0, "&scope=saved")
	if len(saved) != 1 || saved[0].ID != first {
		t.Fatalf("saved search ignored scope: %+v", saved)
	}
}
