package main

import (
	"chatnet/internal/authx"
	"chatnet/internal/database"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestPublicPostLocation(t *testing.T) {
	now := time.Now()
	ptr := func(n float64) *float64 { return &n }
	for _, tc := range []struct {
		name     string
		location *postLocation
		valid    bool
	}{
		{"missing", nil, false},
		{"exact limit", &postLocation{ptr(21), ptr(105), ptr(10), now, ""}, true},
		{"zero coordinates", &postLocation{ptr(0), ptr(0), ptr(5), now, ""}, true},
		{"approximate", &postLocation{ptr(21), ptr(105), ptr(10.01), now, ""}, true},
		{"network", &postLocation{ptr(21), ptr(105), ptr(1500), now, ""}, true},
		{"infinite accuracy", &postLocation{ptr(21), ptr(105), ptr(math.Inf(1)), now, ""}, false},
		{"zero accuracy", &postLocation{ptr(21), ptr(105), ptr(0), now, ""}, false},
		{"missing latitude", &postLocation{nil, ptr(105), ptr(5), now, ""}, false},
		{"out of range", &postLocation{ptr(91), ptr(105), ptr(5), now, ""}, false},
		{"nan", &postLocation{ptr(math.NaN()), ptr(105), ptr(5), now, ""}, false},
		{"stale", &postLocation{ptr(21), ptr(105), ptr(5), now.Add(-3 * time.Minute), ""}, false},
		{"future", &postLocation{ptr(21), ptr(105), ptr(5), now.Add(time.Minute), ""}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if validPostLocation(tc.location, now) != tc.valid {
				t.Fatal("unexpected validation result")
			}
		})
	}
}
func testLocationJSON(accuracy float64, captured time.Time) string {
	return fmt.Sprintf(`{"latitude":21.02,"longitude":105.83,"accuracy":%g,"capturedAt":%q,"placeName":"Hà Nội, Việt Nam"}`, accuracy, captured.UTC().Format(time.RFC3339Nano))
}

func TestPublicPostRejectsMissingOrInvalidGPS(t *testing.T) {
	s := &server{}
	for _, body := range []string{
		`{"content":"hello"}`,
		`{"content":"hello","visibility":"public","publishLocation":null}`,
		fmt.Sprintf(`{"content":"hello","publishLocation":%s}`, testLocationJSON(0, time.Now())),
		fmt.Sprintf(`{"content":"hello","publishLocation":%s}`, testLocationJSON(5, time.Now().Add(-3*time.Minute))),
	} {
		w := httptest.NewRecorder()
		s.create(w, httptest.NewRequest("POST", "/api/posts", strings.NewReader(body)))
		if w.Code != 400 || !strings.Contains(w.Body.String(), "vị trí hiện tại") {
			t.Fatalf("got %d %s", w.Code, w.Body.String())
		}
	}
}

func TestPublicPostLocationIntegration(t *testing.T) {
	url := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("gps_%d", time.Now().UnixNano())
	var uid int64
	if err := db.QueryRow(ctx, "INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,'!',$2) RETURNING id", name+"@example.invalid", name).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", uid)
	token, err := authx.Sign("gps-test", uid, name, name)
	if err != nil {
		t.Fatal(err)
	}
	s := &server{db: db}
	mux := http.NewServeMux()
	for route, handler := range map[string]http.HandlerFunc{"POST /api/posts": s.create, "GET /api/posts": s.list, "GET /api/posts/{id}": s.detailPost, "PATCH /api/posts/{id}": s.editPost} {
		mux.Handle(route, authx.Middleware("gps-test", handler))
	}
	call := func(method, path, body string, want int) []byte {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s %s got %d want %d: %s", method, path, w.Code, want, w.Body.String())
		}
		return w.Body.Bytes()
	}
	read := func(b []byte) (p post) {
		t.Helper()
		if err := json.Unmarshal(b, &p); err != nil {
			t.Fatal(err)
		}
		return
	}
	loc := testLocationJSON(1200, time.Now())
	call("POST", "/api/posts", `{"content":"missing"}`, 400)
	created := read(call("POST", "/api/posts", fmt.Sprintf(`{"content":"public","publishLocation":%s}`, loc), 201))
	if created.PublishLocation == nil || *created.PublishLocation.Accuracy != 1200 || created.PublishLocation.PlaceName != "Hà Nội, Việt Nam" {
		t.Fatal("missing created GPS")
	}
	path := fmt.Sprintf("/api/posts/%d", created.ID)
	detail := read(call("GET", path, "", 200))
	if detail.PublishLocation == nil || *detail.PublishLocation.Latitude != 21.02 || detail.PublishLocation.PlaceName != "Hà Nội, Việt Nam" {
		t.Fatal("missing detail GPS")
	}
	var listed []post
	if err := json.Unmarshal(call("GET", "/api/posts?scope=mine", "", 200), &listed); err != nil || len(listed) != 1 || listed[0].PublishLocation == nil {
		t.Fatalf("list GPS: %+v %v", listed, err)
	}
	edited := read(call("PATCH", path, `{"content":"edited","visibility":"public"}`, 200))
	if edited.PublishLocation == nil || !edited.PublishLocation.CapturedAt.Equal(detail.PublishLocation.CapturedAt) {
		t.Fatal("edit changed original GPS")
	}
	private := read(call("PATCH", path, `{"content":"hidden","visibility":"private"}`, 200))
	if private.PublishLocation != nil {
		t.Fatal("private response leaked GPS")
	}
	var removed bool
	if err := db.QueryRow(ctx, "SELECT publish_location IS NULL FROM posts WHERE id=$1", created.ID).Scan(&removed); err != nil || !removed {
		t.Fatalf("private GPS not erased: %v", err)
	}
	call("PATCH", path, `{"content":"public again","visibility":"public"}`, 400)
	reopened := read(call("PATCH", path, fmt.Sprintf(`{"content":"public again","visibility":"public","publishLocation":%s}`, testLocationJSON(5, time.Now())), 200))
	if reopened.PublishLocation == nil || *reopened.PublishLocation.Accuracy != 5 {
		t.Fatal("republish lacks fresh GPS")
	}
	friends := read(call("POST", "/api/posts", fmt.Sprintf(`{"content":"friends","visibility":"friends","publishLocation":%s}`, loc), 201))
	if friends.PublishLocation != nil {
		t.Fatal("friends post leaked GPS")
	}
}
