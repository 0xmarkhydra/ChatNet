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

func TestMarketplaceProductSearchCursorIntegration(t *testing.T) {
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

	username := fmt.Sprintf("product_search_%d", time.Now().UnixNano())
	var sellerID int64
	if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
		VALUES($1,$2,'!',$2) RETURNING id`, username+"@example.com", username).Scan(&sellerID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "DELETE FROM users WHERE id=$1", sellerID)
	insert := func(title, status string) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(ctx, `INSERT INTO market_products(seller_id,title,description,price_amount,price_unit,stock,status)
			VALUES($1,$2,$3,100,'TEST',2,$4) RETURNING id`, sellerID, title, "Search description", status).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	first := insert(username+" alpha", "published")
	second := insert(username+" beta", "published")
	draft := insert(username+" draft", "draft")
	defer func() {
		_, _ = db.Exec(context.Background(), "DELETE FROM market_products WHERE id=ANY($1::bigint[])", []int64{first, second, draft})
	}()
	token, err := authx.Sign("market-search-test", sellerID, username, username)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	(&server{db: db, jwtSecret: "market-search-test"}).mountMarketplace(mux)
	searchPage := func(cursor string) (int, []marketProduct, *string) {
		t.Helper()
		path := "/api/marketplace/products?q=" + url.QueryEscape(username) + "&sort=relevance&limit=1"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		var response struct {
			Items      []marketProduct `json:"items"`
			NextCursor *string         `json:"nextCursor"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatalf("product search JSON: %v: %s", err, rec.Body.String())
		}
		return rec.Code, response.Items, response.NextCursor
	}
	status, page1, cursor := searchPage("")
	if status != http.StatusOK || len(page1) != 1 || page1[0].Status != "published" || cursor == nil {
		t.Fatalf("invalid first product page: status=%d items=%+v cursor=%v", status, page1, cursor)
	}
	status, page2, next := searchPage(*cursor)
	if status != http.StatusOK || len(page2) != 1 || page2[0].Status != "published" || next != nil || page1[0].ID == page2[0].ID {
		t.Fatalf("invalid second product page: status=%d items=%+v cursor=%v", status, page2, next)
	}
	if page1[0].ID == draft || page2[0].ID == draft {
		t.Fatal("draft product leaked into public search")
	}
}
