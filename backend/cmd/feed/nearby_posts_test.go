package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestNearbyPostsRejectInvalidSearch(t *testing.T) {
	for _, body := range []string{
		`{}`, `{"latitude":91,"longitude":105}`, `{"latitude":21,"longitude":181}`,
		`{"latitude":21,"longitude":105,"radiusKm":51}`, `{"latitude":21,"longitude":105,"limit":31}`,
		`{"latitude":21,"longitude":105,"cursor":{"id":1}}`,
		`{"latitude":21,"longitude":105,"cursor":{"id":1,"distanceMeters":6000}}`,
		`{"latitude":21,"longitude":105,"userId":1}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/api/posts/nearby", strings.NewReader(body))
		rec := httptest.NewRecorder()
		(&server{}).nearbyPosts(rec, req)
		if rec.Code != 400 {
			t.Fatalf("%s: status %d", body, rec.Code)
		}
	}
}

func TestNearbyPostsDistancePrivacyIntegration(t *testing.T) {
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
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	prefix := fmt.Sprintf("nearpost_%d", time.Now().UnixNano())
	ids := make([]int64, 3)
	for i := range ids {
		name := fmt.Sprintf("%s_%d", prefix, i)
		if err = db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'test',$2) RETURNING id`, name+"@example.invalid", name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		id := ids[i]
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id)
	}
	if _, err = db.Exec(ctx, "INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", ids[0], ids[2]); err != nil {
		t.Fatal(err)
	}
	insert := func(user int, visibility string, location any) int64 {
		t.Helper()
		var id int64
		if err = db.QueryRow(ctx, `INSERT INTO posts(user_id,content,visibility,publish_location) VALUES($1,$2,$3,$4::jsonb) RETURNING id`, ids[user], prefix, visibility, location).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	// Isolated fixture coordinates far from populated test locations.
	closest := insert(1, "public", `{"latitude":-78.001,"longitude":30}`)
	tie := insert(1, "public", `{"latitude":-78.001,"longitude":30}`)
	farther := insert(1, "public", `{"latitude":-78.02,"longitude":30}`)
	insert(1, "public", `{"latitude":-79,"longitude":30}`)
	insert(0, "private", `{"latitude":-78,"longitude":30}`)
	insert(0, "friends", `{"latitude":-78,"longitude":30}`)
	insert(2, "public", `{"latitude":-78,"longitude":30}`)
	insert(1, "public", nil)
	insert(1, "public", `{"latitude":"bad","longitude":30}`)
	token, err := authx.Sign("nearpost-test", ids[0], prefix, prefix)
	if err != nil {
		t.Fatal(err)
	}
	handler := authx.Middleware("nearpost-test", http.HandlerFunc((&server{db: db}).nearbyPosts))
	find := func(cursor *nearbyPostCursor) ([]nearbyPost, *nearbyPostCursor) {
		t.Helper()
		lat, lon := -78.0, 30.0
		body, _ := json.Marshal(nearbyPostsInput{Latitude: &lat, Longitude: &lon, RadiusKm: 5, Limit: 2, Cursor: cursor})
		req := httptest.NewRequest(http.MethodPost, "/api/posts/nearby", strings.NewReader(string(body)))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
		}
		var result struct {
			Posts []nearbyPost      `json:"posts"`
			Next  *nearbyPostCursor `json:"nextCursor"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(rec.Body.String(), "latitude") {
			t.Fatal("raw location in response")
		}
		return result.Posts, result.Next
	}
	page, next := find(nil)
	if len(page) != 2 || page[0].ID != tie || page[1].ID != closest || next == nil || page[0].DistanceMeters < 100 || page[0].DistanceMeters > 120 {
		t.Fatalf("unexpected first page: %+v", page)
	}
	page, next = find(next)
	if len(page) != 1 || page[0].ID != farther || next != nil {
		t.Fatalf("unexpected next page: %+v", page)
	}
}
