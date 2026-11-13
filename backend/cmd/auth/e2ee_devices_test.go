package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
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
	"chatnet/internal/ratelimit"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func testE2EEID(t *testing.T) string {
	t.Helper()
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		t.Fatal(err)
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", raw[:4], raw[4:6], raw[6:8], raw[8:10], raw[10:])
}

func testE2EEBody(t *testing.T, userID int64, sid, challenge string) e2eeDeviceRegistration {
	t.Helper()
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	body := e2eeDeviceRegistration{
		DeviceID: testE2EEID(t), IdentityKey: base64.RawURLEncoding.EncodeToString(public),
		Challenge: challenge, Label: "Browser",
	}
	body.Signature = base64.RawURLEncoding.EncodeToString(ed25519.Sign(private,
		e2eeRegistrationTranscript(userID, sid, body)))
	return body
}

func TestE2EERegistrationProof(t *testing.T) {
	uid := int64(34)
	sid := testE2EEID(t)
	nonce := base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	body := testE2EEBody(t, uid, sid, nonce)
	data, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	got, public, sig, ok := decodeE2EERegistration(w,
		httptest.NewRequest(http.MethodPost, "/api/auth/e2ee/devices", bytes.NewReader(data)))
	if !ok || w.Code != http.StatusOK || !ed25519.Verify(public, e2eeRegistrationTranscript(uid, sid, got), sig) {
		t.Fatalf("valid device signature rejected: status=%d", w.Code)
	}
	if ed25519.Verify(public, e2eeRegistrationTranscript(uid+1, sid, got), sig) ||
		ed25519.Verify(public, e2eeRegistrationTranscript(uid, testE2EEID(t), got), sig) {
		t.Fatal("proof must bind to account and session")
	}
	got.DeviceID = testE2EEID(t)
	if ed25519.Verify(public, e2eeRegistrationTranscript(uid, sid, got), sig) {
		t.Fatal("proof must bind to device ID")
	}
	got = body
	got.Label = "Spoofed device"
	if ed25519.Verify(public, e2eeRegistrationTranscript(uid, sid, got), sig) {
		t.Fatal("proof must bind to device label")
	}
}

func TestE2EERegistrationRejectsInvalidFields(t *testing.T) {
	valid := testE2EEBody(t, 1, testE2EEID(t), base64.RawURLEncoding.EncodeToString(make([]byte, 32)))
	cases := map[string]func(*e2eeDeviceRegistration){
		"invalid UUID":      func(b *e2eeDeviceRegistration) { b.DeviceID = "not-uuid" },
		"invalid key":       func(b *e2eeDeviceRegistration) { b.IdentityKey = "x" },
		"invalid signature": func(b *e2eeDeviceRegistration) { b.Signature = "x" },
		"invalid challenge": func(b *e2eeDeviceRegistration) { b.Challenge = "x" },
		"oversized label":   func(b *e2eeDeviceRegistration) { b.Label = strings.Repeat("x", 81) },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			body := valid
			change(&body)
			data, _ := json.Marshal(body)
			w := httptest.NewRecorder()
			_, _, _, ok := decodeE2EERegistration(w, httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(data)))
			if ok || w.Code != http.StatusBadRequest {
				t.Fatalf("invalid registration accepted: %d", w.Code)
			}
		})
	}
	for _, raw := range []string{`{"unexpected":1}`, `{"deviceId":`, `{} {}`} {
		w := httptest.NewRecorder()
		_, _, _, ok := decodeE2EERegistration(w, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(raw)))
		if ok || w.Code != http.StatusBadRequest {
			t.Fatalf("malformed registration accepted: %d", w.Code)
		}
	}
}

func TestE2EEFeatureDisabledByDefault(t *testing.T) {
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "")
	s := &server{}
	for _, handler := range []http.HandlerFunc{s.newE2EEChallenge, s.registerE2EEDevice, s.listE2EEDevices} {
		w := httptest.NewRecorder()
		handler(w, httptest.NewRequest(http.MethodGet, "/", nil))
		if w.Code != http.StatusNotFound {
			t.Fatalf("E2EE API available before rollout: %d", w.Code)
		}
	}
}

// Opt-in integration: never mutate a shared production DB.
func TestE2EEDeviceDirectoryIntegration(t *testing.T) {
	dbURL, redisAddr := os.Getenv("CHATNET_TEST_DATABASE_URL"), os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if dbURL == "" || redisAddr == "" {
		t.Skip("set CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR for isolated PostgreSQL/Redis")
	}
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "1")
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	redisClient := redis.NewClient(&redis.Options{Addr: redisAddr})
	defer redisClient.Close()
	s := &server{db: db, redis: redisClient, limiter: ratelimit.Limiter{Redis: redisClient}, jwtSecret: "integration-secret"}
	var ids [2]int64
	var sids [2]string
	var tokens [2]string
	for i := range ids {
		name := fmt.Sprintf("e2ee_%d_%d", time.Now().UnixNano(), i)
		err = db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!', 'E2EE QA') RETURNING id`, name+"@example.test", name).Scan(&ids[i])
		if err != nil {
			t.Fatal(err)
		}
		defer func(id int64) { _, _ = db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id) }(ids[i])
		err = db.QueryRow(ctx, `INSERT INTO auth_sessions(token_hash,user_id,expires_at)
			VALUES($1,$2,NOW()+INTERVAL '1 hour') RETURNING session_id::text`, testE2EEID(t), ids[i]).Scan(&sids[i])
		if err != nil {
			t.Fatal(err)
		}
		tokens[i], err = authx.Sign(s.jwtSecret, ids[i], name, name, sids[i])
		if err != nil {
			t.Fatal(err)
		}
	}
	send := func(actor int, method, url string, handler http.HandlerFunc, input any, bearer bool) *httptest.ResponseRecorder {
		t.Helper()
		var body []byte
		if input != nil {
			body, _ = json.Marshal(input)
		}
		r := httptest.NewRequest(method, url, bytes.NewReader(body))
		if bearer {
			r.Header.Set("Authorization", "Bearer "+tokens[actor])
		}
		// SUT uses the real shared session and revocation middleware.
		w := httptest.NewRecorder()
		authx.CachedSessionMiddleware(s.jwtSecret, db, redisClient, handler).ServeHTTP(w, r)
		return w
	}
	if w := send(0, "POST", "/api/auth/e2ee/challenge", s.newE2EEChallenge, nil, false); w.Code != 401 {
		t.Fatalf("challenge without session: %d", w.Code)
	}
	challenge := func(actor int) string {
		t.Helper()
		w := send(actor, "POST", "/api/auth/e2ee/challenge", s.newE2EEChallenge, nil, true)
		if w.Code != 201 {
			t.Fatalf("challenge: %d %s", w.Code, w.Body.String())
		}
		var response struct {
			Challenge string `json:"challenge"`
		}
		if json.Unmarshal(w.Body.Bytes(), &response) != nil || response.Challenge == "" {
			t.Fatal("challenge missing")
		}
		return response.Challenge
	}
	nonce := challenge(0)
	device := testE2EEBody(t, ids[0], sids[0], nonce)
	forged := device
	forged.DeviceID = testE2EEID(t)
	if w := send(0, "POST", "/api/auth/e2ee/devices", s.registerE2EEDevice, forged, true); w.Code != 403 {
		t.Fatalf("forged device identity: %d", w.Code)
	}
	if w := send(0, "POST", "/api/auth/e2ee/devices", s.registerE2EEDevice, device, true); w.Code != 201 {
		t.Fatalf("valid device registration: %d %s", w.Code, w.Body.String())
	}
	if w := send(0, "POST", "/api/auth/e2ee/devices", s.registerE2EEDevice, device, true); w.Code != 409 {
		t.Fatalf("replayed challenge accepted: %d", w.Code)
	}
	w := send(0, "GET", "/api/auth/e2ee/devices", s.listE2EEDevices, nil, true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), device.IdentityKey) {
		t.Fatalf("self device directory: %d %s", w.Code, w.Body.String())
	}
	peerPath := fmt.Sprintf("/api/auth/e2ee/users/%d/devices", ids[0])
	peerHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.SetPathValue("userId", fmt.Sprint(ids[0]))
		s.listE2EEDevices(w, r)
	})
	w = send(1, "GET", peerPath, peerHandler, nil, true)
	if w.Code != 404 {
		t.Fatalf("outsider listed devices: %d", w.Code)
	}
	var conversationID int64
	err = db.QueryRow(ctx, `INSERT INTO conversations(type,created_by) VALUES('direct',$1) RETURNING id`, ids[0]).Scan(&conversationID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", conversationID) }()
	for _, id := range ids {
		if _, err = db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", conversationID, id); err != nil {
			t.Fatal(err)
		}
	}
	w = send(1, "GET", peerPath, peerHandler, nil, true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), device.IdentityKey) {
		t.Fatalf("authorized peer lookup: %d %s", w.Code, w.Body.String())
	}
	// The URL path variable must be set by ServeMux in production.
}
