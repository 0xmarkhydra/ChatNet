package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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
	"chatnet/internal/ratelimit"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func signedE2EEPackage(t *testing.T, uid int64, sid, deviceID, challenge string, private ed25519.PrivateKey) e2eePackagePublish {
	t.Helper()
	payload := make([]byte, 108)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}
	body := e2eePackagePublish{
		DeviceID: deviceID, PackageID: testE2EEID(t), Challenge: challenge,
		Package: base64.RawURLEncoding.EncodeToString(payload),
	}
	digest := sha256.Sum256(payload)
	body.Signature = base64.RawURLEncoding.EncodeToString(
		ed25519.Sign(private, e2eePackageTranscript(uid, sid, body, digest)))
	return body
}

func TestE2EEKeyPackageProofAndValidation(t *testing.T) {
	uid := int64(91)
	session := testE2EEID(t)
	challenge := base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	body := signedE2EEPackage(t, uid, session, testE2EEID(t), challenge, private)
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	decoded, raw, sig, digest, ok := decodeE2EEPublish(
		w, httptest.NewRequest("POST", "/api/auth/e2ee/key-packages", bytes.NewReader(encoded)))
	if !ok || !bytes.Equal(raw, mustDecodeBase64(t, body.Package)) {
		t.Fatalf("valid KeyPackage encoding rejected: %d", w.Code)
	}
	if !ed25519.Verify(public, e2eePackageTranscript(uid, session, decoded, digest), sig) ||
		ed25519.Verify(public, e2eePackageTranscript(uid+1, session, decoded, digest), sig) ||
		ed25519.Verify(public, e2eePackageTranscript(uid, testE2EEID(t), decoded, digest), sig) {
		t.Fatal("signature must bind to user, session and package")
	}
	changed := decoded
	changed.PackageID = testE2EEID(t)
	if ed25519.Verify(public, e2eePackageTranscript(uid, session, changed, digest), sig) {
		t.Fatal("signature must bind to KeyPackage ID")
	}
	for name, change := range map[string]func(*e2eePackagePublish){
		"invalid device":     func(v *e2eePackagePublish) { v.DeviceID = "no" },
		"invalid package ID": func(v *e2eePackagePublish) { v.PackageID = "no" },
		"malformed package":  func(v *e2eePackagePublish) { v.Package = "=" },
		"oversized package": func(v *e2eePackagePublish) {
			v.Package = base64.RawURLEncoding.EncodeToString(make([]byte, e2eeMaxPackageBytes+1))
		},
		"undersized package": func(v *e2eePackagePublish) {
			v.Package = base64.RawURLEncoding.EncodeToString(make([]byte, 63))
		},
		"invalid signature": func(v *e2eePackagePublish) { v.Signature = "wrong" },
		"invalid challenge": func(v *e2eePackagePublish) { v.Challenge = "wrong" },
	} {
		t.Run(name, func(t *testing.T) {
			value := body
			change(&value)
			payload, _ := json.Marshal(value)
			recorder := httptest.NewRecorder()
			_, _, _, _, accepted := decodeE2EEPublish(
				recorder, httptest.NewRequest("POST", "/", bytes.NewReader(payload)))
			if accepted || recorder.Code != http.StatusBadRequest {
				t.Fatalf("accepted malformed KeyPackage: %d", recorder.Code)
			}
		})
	}
}

func mustDecodeBase64(t *testing.T, value string) []byte {
	t.Helper()
	out, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestE2EEClaimValidationAndFeatureFlag(t *testing.T) {
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "")
	s := &server{}
	for _, handler := range []http.HandlerFunc{s.publishE2EEKeyPackage, s.claimE2EEKeyPackage} {
		w := httptest.NewRecorder()
		handler(w, httptest.NewRequest("POST", "/", strings.NewReader("{}")))
		if w.Code != http.StatusNotFound {
			t.Fatalf("KeyPackage endpoint enabled unexpectedly: %d", w.Code)
		}
	}
	for _, payload := range []string{
		"{}", `{"userId":0,"deviceId":"bad"}`, `{"userId":3,"deviceId":"bad"}`,
		`{"userId":2,"deviceId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","unknown":true}`,
	} {
		w := httptest.NewRecorder()
		if _, ok := decodeE2EEClaim(w, httptest.NewRequest("POST", "/", strings.NewReader(payload))); ok || w.Code != http.StatusBadRequest {
			t.Fatalf("accepted invalid claim: %s", payload)
		}
	}
}

func TestE2EEKeyPackageExchangeIntegration(t *testing.T) {
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
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	defer rdb.Close()
	s := &server{db: db, redis: rdb, limiter: ratelimit.Limiter{Redis: rdb}, jwtSecret: "kp-test-secret"}

	var users [2]int64
	var sessions [2]string
	var tokens [2]string
	for i := range users {
		username := fmt.Sprintf("e2eekp_%d_%d", time.Now().UnixNano(), i)
		err = db.QueryRow(ctx, `
			INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!', 'KeyPackage tester') RETURNING id
		`, username+"@example.test", username).Scan(&users[i])
		if err != nil {
			t.Fatal(err)
		}
		defer func(id int64) { _, _ = db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id) }(users[i])
		err = db.QueryRow(ctx, `
			INSERT INTO auth_sessions(token_hash,user_id,expires_at)
			VALUES($1,$2,NOW()+INTERVAL '1 hour') RETURNING session_id::text
		`, testE2EEID(t), users[i]).Scan(&sessions[i])
		if err != nil {
			t.Fatal(err)
		}
		tokens[i], err = authx.Sign(s.jwtSecret, users[i], username, username, sessions[i])
		if err != nil {
			t.Fatal(err)
		}
	}
	send := func(actor int, path string, handler http.HandlerFunc, payload any, authed bool) *httptest.ResponseRecorder {
		t.Helper()
		raw, _ := json.Marshal(payload)
		if payload == nil {
			raw = nil
		}
		r := httptest.NewRequest("POST", path, bytes.NewReader(raw))
		if authed {
			r.Header.Set("Authorization", "Bearer "+tokens[actor])
		}
		w := httptest.NewRecorder()
		authx.CachedSessionMiddleware(s.jwtSecret, db, rdb, handler).ServeHTTP(w, r)
		return w
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	deviceID := testE2EEID(t)
	_, err = db.Exec(ctx, `
		INSERT INTO e2ee_devices(id,user_id,identity_key,label)
		VALUES($1::uuid,$2,$3,'test device')
	`, deviceID, users[0], []byte(publicKey))
	if err != nil {
		t.Fatal(err)
	}
	challenge := func() string {
		t.Helper()
		w := send(0, "/api/auth/e2ee/challenge", s.newE2EEChallenge, nil, true)
		if w.Code != http.StatusCreated {
			t.Fatalf("challenge: %d %s", w.Code, w.Body.String())
		}
		var result struct {
			Challenge string `json:"challenge"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result.Challenge
	}
	publish := func() e2eePackagePublish {
		t.Helper()
		body := signedE2EEPackage(t, users[0], sessions[0], deviceID, challenge(), privateKey)
		if w := send(0, "/api/auth/e2ee/key-packages", s.publishE2EEKeyPackage, body, false); w.Code != http.StatusUnauthorized {
			t.Fatalf("unauthenticated publication accepted: %d", w.Code)
		}
		forged := body
		forged.PackageID = testE2EEID(t)
		if w := send(0, "/api/auth/e2ee/key-packages", s.publishE2EEKeyPackage, forged, true); w.Code != http.StatusForbidden {
			t.Fatalf("forged publication accepted: %d %s", w.Code, w.Body.String())
		}
		if w := send(0, "/api/auth/e2ee/key-packages", s.publishE2EEKeyPackage, body, true); w.Code != http.StatusCreated {
			t.Fatalf("cannot publish signed KeyPackage: %d %s", w.Code, w.Body.String())
		}
		if w := send(0, "/api/auth/e2ee/key-packages", s.publishE2EEKeyPackage, body, true); w.Code != http.StatusConflict {
			t.Fatalf("replayed publish challenge accepted: %d", w.Code)
		}
		return body
	}

	first := publish()
	claim := e2eePackageClaim{DeviceID: deviceID, UserID: users[0]}
	if w := send(1, "/api/auth/e2ee/key-packages/claim", s.claimE2EEKeyPackage, claim, true); w.Code != http.StatusNotFound {
		t.Fatalf("unrelated user consumed package: %d %s", w.Code, w.Body.String())
	}
	var conversationID int64
	err = db.QueryRow(ctx, `INSERT INTO conversations(type,created_by) VALUES('direct',$1) RETURNING id`, users[0]).Scan(&conversationID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", conversationID) }()
	for _, id := range users {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)`, conversationID, id); err != nil {
			t.Fatal(err)
		}
	}
	w := send(1, "/api/auth/e2ee/key-packages/claim", s.claimE2EEKeyPackage, claim, true)
	if w.Code != http.StatusOK {
		t.Fatalf("authorized claim: %d %s", w.Code, w.Body.String())
	}
	var received e2eeClaimedPackage
	if err := json.Unmarshal(w.Body.Bytes(), &received); err != nil || received.PackageID != first.PackageID || received.Package != first.Package {
		t.Fatalf("wrong KeyPackage delivered: %+v %v", received, err)
	}
	if received.UserID != users[0] || received.SessionID != sessions[0] ||
		received.DeviceID != first.DeviceID || received.Challenge != first.Challenge ||
		received.Signature != first.Signature {
		t.Fatal("claimed KeyPackage missing verifiable publisher identity proof")
	}
	attestedBytes := mustDecodeBase64(t, received.Package)
	attestedDigest := sha256.Sum256(attestedBytes)
	claimedProof := e2eePackagePublish{
		DeviceID: received.DeviceID, PackageID: received.PackageID,
		Challenge: received.Challenge,
	}
	if !ed25519.Verify(publicKey, e2eePackageTranscript(
		received.UserID, received.SessionID, claimedProof, attestedDigest,
	), mustDecodeBase64(t, received.Signature)) {
		t.Fatal("claimed KeyPackage publisher proof invalid")
	}
	attestedDigest[0] ^= 1
	if ed25519.Verify(publicKey, e2eePackageTranscript(
		received.UserID, received.SessionID, claimedProof, attestedDigest,
	), mustDecodeBase64(t, received.Signature)) {
		t.Fatal("tampered KeyPackage attestation was accepted")
	}
	if w := send(1, "/api/auth/e2ee/key-packages/claim", s.claimE2EEKeyPackage, claim, true); w.Code != http.StatusConflict {
		t.Fatalf("consumed package recycled: %d", w.Code)
	}

	second := signedE2EEPackage(t, users[0], sessions[0], deviceID, challenge(), privateKey)
	third := signedE2EEPackage(t, users[0], sessions[0], deviceID, challenge(), privateKey)
	for _, body := range []e2eePackagePublish{second, third} {
		if w := send(0, "/api/auth/e2ee/key-packages", s.publishE2EEKeyPackage, body, true); w.Code != http.StatusCreated {
			t.Fatalf("cannot publish package for concurrency test: %d %s", w.Code, w.Body.String())
		}
	}
	var wg sync.WaitGroup
	var successes [2]string
	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func(index int) {
			defer wg.Done()
			response := send(1, "/api/auth/e2ee/key-packages/claim", s.claimE2EEKeyPackage, claim, true)
			if response.Code != http.StatusOK {
				successes[index] = fmt.Sprintf("HTTP-%d", response.Code)
				return
			}
			var claimed e2eeClaimedPackage
			if json.Unmarshal(response.Body.Bytes(), &claimed) == nil {
				successes[index] = claimed.PackageID
			}
		}(i)
	}
	wg.Wait()
	if successes[0] == "" || successes[1] == "" || successes[0] == successes[1] ||
		strings.HasPrefix(successes[0], "HTTP-") || strings.HasPrefix(successes[1], "HTTP-") {
		t.Fatalf("concurrent claims returned duplicate/failed packages: %v", successes)
	}
	var claimed int
	err = db.QueryRow(ctx, `
		SELECT count(*) FROM e2ee_key_packages WHERE device_id=$1::uuid AND claimed_at IS NOT NULL AND claimed_by=$2
	`, deviceID, users[1]).Scan(&claimed)
	if err != nil || claimed != 3 {
		t.Fatalf("claimed packages not uniquely recorded: %d %v", claimed, err)
	}

	pending := signedE2EEPackage(t, users[0], sessions[0], deviceID, challenge(), privateKey)
	if w := send(0, "/api/auth/e2ee/key-packages", s.publishE2EEKeyPackage, pending, true); w.Code != http.StatusCreated {
		t.Fatalf("publish pending package before revocation: %d %s", w.Code, w.Body.String())
	}
	revoke := e2eeDeviceRevocation{AuthorizingDeviceID: deviceID, Challenge: challenge()}
	revoke.Signature = base64.RawURLEncoding.EncodeToString(ed25519.Sign(privateKey,
		e2eeRevokeTranscript(users[0], sessions[0], deviceID, revoke)))
	revokeHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.SetPathValue("deviceId", deviceID)
		s.revokeE2EEDevice(w, r)
	})
	badRevoke := revoke
	badRevoke.AuthorizingDeviceID = testE2EEID(t)
	if w := send(0, "/api/auth/e2ee/devices/revoke", revokeHandler, badRevoke, true); w.Code != http.StatusNotFound {
		t.Fatalf("unsigned revocation accepted: %d", w.Code)
	}
	if w := send(0, "/api/auth/e2ee/devices/revoke", revokeHandler, revoke, true); w.Code != http.StatusNoContent {
		t.Fatalf("valid signed device revocation: %d %s", w.Code, w.Body.String())
	}
	if w := send(0, "/api/auth/e2ee/devices/revoke", revokeHandler, revoke, true); w.Code != http.StatusNotFound {
		t.Fatalf("replayed/revoked authorizer accepted: %d", w.Code)
	}
	if w := send(1, "/api/auth/e2ee/key-packages/claim", s.claimE2EEKeyPackage, claim, true); w.Code != http.StatusNotFound {
		t.Fatalf("revoked device package claim succeeded: %d", w.Code)
	}
	var unclaimed int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM e2ee_key_packages WHERE device_id=$1::uuid AND claimed_at IS NULL", deviceID).Scan(&unclaimed); err != nil || unclaimed != 0 {
		t.Fatalf("revoked device still has unclaimed packages: %d %v", unclaimed, err)
	}
}
