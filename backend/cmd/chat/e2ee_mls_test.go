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
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func testMLSUUID(t *testing.T) string {
	t.Helper()
	data := make([]byte, 16)
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}
	data[6] = data[6]&0x0f | 0x40
	data[8] = data[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", data[:4], data[4:6], data[6:8], data[8:10], data[10:])
}

func signedMLSEvent(t *testing.T, userID, conversationID, epoch int64, deviceID, kind, target string, key ed25519.PrivateKey) mlsRelayInput {
	t.Helper()
	payload := make([]byte, 200)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}
	input := mlsRelayInput{
		DeviceID: deviceID, ClientID: testMLSUUID(t), Epoch: epoch, EventType: kind,
		TargetDeviceID: target, Payload: base64.RawURLEncoding.EncodeToString(payload),
	}
	digest := sha256.Sum256(payload)
	input.Signature = base64.RawURLEncoding.EncodeToString(ed25519.Sign(
		key, mlsRelayTranscript(userID, conversationID, input, digest)))
	return input
}

func TestMLSTransportProofAndValidation(t *testing.T) {
	uid, conversationID := int64(25), int64(100)
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	valid := signedMLSEvent(t, uid, conversationID, 1, testMLSUUID(t), "commit", "", priv)
	raw, err := json.Marshal(valid)
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	parsed, payload, signature, digest, ok := decodeMLSRelayInput(w, httptest.NewRequest("POST", "/", bytes.NewReader(raw)))
	if !ok || !ed25519.Verify(pub, mlsRelayTranscript(uid, conversationID, parsed, digest), signature) ||
		ed25519.Verify(pub, mlsRelayTranscript(uid, conversationID+1, parsed, digest), signature) {
		t.Fatal("MLS transport identity proof invalid or not bound to conversation")
	}
	altered := parsed
	altered.Epoch++
	if ed25519.Verify(pub, mlsRelayTranscript(uid, conversationID, altered, digest), signature) {
		t.Fatal("MLS epoch was not signed")
	}
	altered = parsed
	altered.ClientID = testMLSUUID(t)
	if ed25519.Verify(pub, mlsRelayTranscript(uid, conversationID, altered, digest), signature) {
		t.Fatal("MLS idempotency key was not signed")
	}
	digest[0] ^= 1
	if ed25519.Verify(pub, mlsRelayTranscript(uid, conversationID, parsed, digest), signature) {
		t.Fatal("MLS ciphertext digest was not signed")
	}
	if len(payload) != 200 {
		t.Fatalf("unexpected payload size: %d", len(payload))
	}

	for label, change := range map[string]func(*mlsRelayInput){
		"invalid device":      func(x *mlsRelayInput) { x.DeviceID = "broken" },
		"invalid idempotency": func(x *mlsRelayInput) { x.ClientID = "broken" },
		"negative epoch":      func(x *mlsRelayInput) { x.Epoch = -1 },
		"unexpected event":    func(x *mlsRelayInput) { x.EventType = "plaintext" },
		"untargeted welcome":  func(x *mlsRelayInput) { x.EventType = "welcome" },
		"wrong target":        func(x *mlsRelayInput) { x.TargetDeviceID = testMLSUUID(t) },
		"empty payload":       func(x *mlsRelayInput) { x.Payload = "" },
		"bad signature":       func(x *mlsRelayInput) { x.Signature = "abc" },
		"oversized payload": func(x *mlsRelayInput) {
			x.Payload = base64.RawURLEncoding.EncodeToString(make([]byte, maxMLSRelayBytes+1))
		},
	} {
		t.Run(label, func(t *testing.T) {
			input := valid
			change(&input)
			body, _ := json.Marshal(input)
			recorder := httptest.NewRecorder()
			_, _, _, _, ok := decodeMLSRelayInput(recorder,
				httptest.NewRequest("POST", "/", bytes.NewReader(body)))
			if ok || recorder.Code != http.StatusBadRequest {
				t.Fatalf("malformed MLS envelope accepted: %d", recorder.Code)
			}
		})
	}
}

func TestMLSRelayEndpointsDisabledByDefault(t *testing.T) {
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "")
	s := &server{}
	for _, test := range []struct {
		handler http.HandlerFunc
		method  string
	}{
		{s.publishMLSEvent, "POST"}, {s.listMLSEvents, "GET"},
	} {
		w := httptest.NewRecorder()
		test.handler(w, httptest.NewRequest(test.method, "/", nil))
		if w.Code != http.StatusNotFound {
			t.Fatalf("experimental MLS endpoint enabled unexpectedly: %d", w.Code)
		}
	}
}

func TestMLSRelayThreeAccountsIntegration(t *testing.T) {
	url, redisAddr := os.Getenv("CHATNET_TEST_DATABASE_URL"), os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if url == "" || redisAddr == "" {
		t.Skip("requires isolated CHATNET_TEST_DATABASE_URL and CHATNET_TEST_REDIS_ADDR")
	}
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "1")
	ctx, cancel := context.WithTimeout(context.Background(), 70*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	defer rdb.Close()
	s := &server{db: db, redis: rdb, jwtSecret: "mls-transport-qa"}
	mux := http.NewServeMux()
	wrap := func(fn http.HandlerFunc) http.Handler {
		return authx.CachedSessionMiddleware(s.jwtSecret, db, rdb, fn)
	}
	mux.Handle("POST /api/conversations/{id}/e2ee/bootstrap", wrap(s.bootstrapMLSConversation))
	mux.Handle("POST /api/conversations/{id}/e2ee/consents", wrap(s.approveMLSPilot))
	mux.Handle("GET /api/conversations/{id}/e2ee/consents", wrap(s.getMLSPilotConsents))
	mux.Handle("POST /api/conversations/{id}/e2ee/events", wrap(s.publishMLSEvent))
	mux.Handle("GET /api/conversations/{id}/e2ee/events", wrap(s.listMLSEvents))
	mux.Handle("GET /api/conversations/{id}/e2ee/status", wrap(s.getMLSConversationStatus))
	mux.Handle("POST /api/conversations/{id}/messages", wrap(s.createMessage))
	mux.Handle("PATCH /api/messages/{id}", wrap(s.editMessage))
	var users [3]int64
	var tokens [3]string
	for i := range users {
		name := fmt.Sprintf("mlsqa_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, name+"@example.test", name).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		defer func(id int64) { _, _ = db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", id) }(users[i])
		var sid string
		if err := db.QueryRow(ctx, `INSERT INTO auth_sessions(token_hash,user_id,expires_at)
			VALUES($1,$2,NOW()+INTERVAL '1 hour') RETURNING session_id::text`,
			testMLSUUID(t), users[i]).Scan(&sid); err != nil {
			t.Fatal(err)
		}
		tokens[i], err = authx.Sign(s.jwtSecret, users[i], name, name, sid)
		if err != nil {
			t.Fatal(err)
		}
	}
	var conversationID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,created_by)
		VALUES('group',$1) RETURNING id`, users[0]).Scan(&conversationID); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", conversationID) }()
	for _, id := range users[:2] {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id)
			VALUES($1,$2)`, conversationID, id); err != nil {
			t.Fatal(err)
		}
	}

	type device struct {
		id  string
		key ed25519.PrivateKey
	}
	var devices [4]device // A, B1, B2, outsider
	for i, owner := range []int64{users[0], users[1], users[1], users[2]} {
		pub, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			t.Fatal(err)
		}
		devices[i] = device{id: testMLSUUID(t), key: priv}
		if _, err := db.Exec(ctx, `
			INSERT INTO e2ee_devices(id,user_id,identity_key,label)
			VALUES($1::uuid,$2,$3,'test')
		`, devices[i].id, owner, []byte(pub)); err != nil {
			t.Fatal(err)
		}
	}
	base := fmt.Sprintf("/api/conversations/%d/e2ee/events", conversationID)
	send := func(actor int, path string, payload any, method string) *httptest.ResponseRecorder {
		var body []byte
		if payload != nil {
			body, _ = json.Marshal(payload)
		}
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		if actor >= 0 {
			req.Header.Set("Authorization", "Bearer "+tokens[actor])
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec
	}
	input := func(actor, deviceIndex int, epoch int64, kind, target string) mlsRelayInput {
		return signedMLSEvent(t, users[actor], conversationID, epoch,
			devices[deviceIndex].id, kind, target, devices[deviceIndex].key)
	}
	get := func(actor, deviceIndex int, query string) (int, struct {
		Events       []mlsRelayEvent `json:"events"`
		NextAfter    int64           `json:"nextAfter"`
		CurrentEpoch int64           `json:"currentEpoch"`
	}) {
		type response struct {
			Events       []mlsRelayEvent `json:"events"`
			NextAfter    int64           `json:"nextAfter"`
			CurrentEpoch int64           `json:"currentEpoch"`
		}
		r := send(actor, base+"?deviceId="+devices[deviceIndex].id+query, nil, "GET")
		var result response
		if r.Code == 200 {
			if err := json.Unmarshal(r.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
		}
		return r.Code, result
	}

	var oldMessageID int64
	legacyText := "legacy historical plaintext before MLS activation"
	if err := db.QueryRow(ctx, `
		INSERT INTO messages(conversation_id,user_id,text)
		VALUES($1,$2,$3) RETURNING id
	`, conversationID, users[0], legacyText).Scan(&oldMessageID); err != nil {
		t.Fatal(err)
	}
	first := input(0, 0, 1, "commit", "")
	statusPath := fmt.Sprintf("/api/conversations/%d/e2ee/status", conversationID)
	if status := send(0, statusPath, nil, "GET"); status.Code != 200 || !strings.Contains(status.Body.String(), `"mode":"legacy"`) {
		t.Fatalf("initial room must be legacy before MLS activation: %d %s", status.Code, status.Body.String())
	}
	if status := send(2, statusPath, nil, "GET"); status.Code != 403 {
		t.Fatalf("outsider read encryption mode: %d", status.Code)
	}
	if r := send(-1, base, first, "POST"); r.Code != 401 {
		t.Fatalf("unauthenticated MLS publication succeeded: %d", r.Code)
	}
	if r := send(2, base, input(2, 3, 1, "commit", ""), "POST"); r.Code != 403 {
		t.Fatalf("outsider MLS publication succeeded: %d", r.Code)
	}
	if r := send(0, base, input(0, 0, 1, "application", ""), "POST"); r.Code != 409 {
		t.Fatalf("application before first MLS commit succeeded: %d %s", r.Code, r.Body.String())
	}
	forged := first
	forged.Payload = base64.RawURLEncoding.EncodeToString(make([]byte, 200))
	if r := send(0, base, forged, "POST"); r.Code != 403 {
		t.Fatalf("tampered MLS envelope accepted: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, base, first, "POST"); r.Code != 201 {
		t.Fatalf("initial MLS commit failed: %d %s", r.Code, r.Body.String())
	}
	if status := send(0, statusPath, nil, "GET"); status.Code != 200 ||
		!strings.Contains(status.Body.String(), `"mode":"e2ee"`) {
		t.Fatalf("MLS room status not encrypted: %d %s", status.Code, status.Body.String())
	}
	if legacy := send(0, fmt.Sprintf("/api/conversations/%d/messages", conversationID),
		map[string]any{"text": "PLAINTEXT MUST NEVER BE STORED", "clientId": testMLSUUID(t)}, "POST"); legacy.Code != http.StatusConflict {
		t.Fatalf("plaintext was not blocked after MLS activation: %d %s", legacy.Code, legacy.Body.String())
	}
	var plainCount int
	if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM messages WHERE conversation_id=$1", conversationID).Scan(&plainCount); err != nil || plainCount != 1 {
		t.Fatalf("plaintext leaked into message storage: count=%d err=%v", plainCount, err)
	}
	editPath := fmt.Sprintf("/api/messages/%d", oldMessageID)
	if edited := send(0, editPath, map[string]any{"text": "new plaintext leaked via edit"}, "PATCH"); edited.Code != http.StatusConflict {
		t.Fatalf("editing old plaintext after MLS activation was not blocked: %d %s", edited.Code, edited.Body.String())
	}
	var oldText string
	if err := db.QueryRow(ctx, "SELECT text FROM messages WHERE id=$1", oldMessageID).Scan(&oldText); err != nil || oldText != legacyText {
		t.Fatalf("historical message changed after MLS cutover: %q %v", oldText, err)
	}
	if r := send(0, base, first, "POST"); r.Code != 200 || !strings.Contains(r.Body.String(), `"duplicate":true`) {
		t.Fatalf("lost-ACK retry not idempotent: %d %s", r.Code, r.Body.String())
	}
	conflict := input(0, 0, 1, "commit", "")
	conflict.ClientID = first.ClientID
	if r := send(0, base, conflict, "POST"); r.Code != 403 {
		t.Fatalf("invalidly signed conflicting request not rejected: %d %s", r.Code, r.Body.String())
	}
	// Valid but conflicting clientId must produce 409, not overwrite the first event.
	digest := sha256.Sum256(mustMLSDecode(t, conflict.Payload))
	conflict.Signature = base64.RawURLEncoding.EncodeToString(ed25519.Sign(
		devices[0].key, mlsRelayTranscript(users[0], conversationID, conflict, digest)))
	if r := send(0, base, conflict, "POST"); r.Code != 409 {
		t.Fatalf("conflicting clientId accepted: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, base, input(0, 0, 1, "commit", ""), "POST"); r.Code != 409 {
		t.Fatalf("stale MLS commit accepted: %d", r.Code)
	}
	welcome := input(0, 0, 1, "welcome", devices[2].id)
	if r := send(0, base, welcome, "POST"); r.Code != 201 {
		t.Fatalf("targeted Welcome rejected: %d %s", r.Code, r.Body.String())
	}
	outsiderWelcome := input(0, 0, 1, "welcome", devices[3].id)
	if r := send(0, base, outsiderWelcome, "POST"); r.Code != 403 {
		t.Fatalf("outsider Welcome accepted: %d", r.Code)
	}
	app := input(0, 0, 1, "application", "")
	if r := send(0, base, app, "POST"); r.Code != 201 {
		t.Fatalf("MLS application event rejected: %d %s", r.Code, r.Body.String())
	}
	if status, page := get(1, 1, ""); status != 200 || page.CurrentEpoch != 1 || len(page.Events) != 2 {
		t.Fatalf("B1 must see commit/application, not B2 Welcome: %d %+v", status, page)
	}
	if status, page := get(1, 2, ""); status != 200 || len(page.Events) != 3 {
		t.Fatalf("B2 must see own targeted Welcome: %d %+v", status, page)
	}
	if status, _ := get(2, 3, ""); status != 403 {
		t.Fatalf("outsider could read MLS events: %d", status)
	}
	if status, page := get(1, 2, "&limit=1"); status != 200 || len(page.Events) != 1 || page.NextAfter == 0 {
		t.Fatalf("MLS first cursor page invalid: %d %+v", status, page)
	} else if status, page := get(1, 2, fmt.Sprintf("&limit=1&after=%d", page.NextAfter)); status != 200 || len(page.Events) != 1 {
		t.Fatalf("MLS next cursor page invalid: %d %+v", status, page)
	}
	if status, _ := get(1, 2, "&limit=1000"); status != 400 {
		t.Fatalf("unbounded MLS paging accepted: %d", status)
	}

	// Two independently signed concurrent commits for epoch 2; exactly one wins.
	var results [2]int
	var wg sync.WaitGroup
	wg.Add(2)
	for i := range results {
		go func(index int) {
			defer wg.Done()
			result := send(0, base, input(0, 0, 2, "commit", ""), "POST")
			results[index] = result.Code
		}(i)
	}
	wg.Wait()
	if !((results[0] == 201 && results[1] == 409) ||
		(results[1] == 201 && results[0] == 409)) {
		t.Fatalf("concurrent commit epoch corruption: %v", results)
	}
	if r := send(0, base, input(0, 0, 1, "application", ""), "POST"); r.Code != 409 {
		t.Fatalf("application sent with old epoch: %d", r.Code)
	}
	if r := send(0, base, input(0, 0, 2, "application", ""), "POST"); r.Code != 201 {
		t.Fatalf("current MLS application rejected: %d %s", r.Code, r.Body.String())
	}
	if status, page := get(1, 2, ""); status != 200 || page.CurrentEpoch != 2 {
		t.Fatalf("MLS epoch did not advance exactly once: %d %+v", status, page)
	}
	// Revocation and group removal must block further retrieval immediately.
	if _, err := db.Exec(ctx, "UPDATE e2ee_devices SET revoked_at=NOW() WHERE id=$1::uuid", devices[2].id); err != nil {
		t.Fatal(err)
	}
	if status, _ := get(1, 2, ""); status != 403 {
		t.Fatalf("revoked device received MLS events: %d", status)
	}
	if _, err := db.Exec(ctx, "DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2", conversationID, users[1]); err != nil {
		t.Fatal(err)
	}
	if status, _ := get(1, 1, ""); status != 403 {
		t.Fatalf("removed member received MLS events: %d", status)
	}
	if r := send(1, base, input(1, 1, 3, "commit", ""), "POST"); r.Code != 403 {
		t.Fatalf("removed member published MLS event: %d", r.Code)
	}

	// Direct pilot must atomically initialize epoch 1 with a targeted Welcome.
	// B2 is now revoked; A and B1 each have exactly one active device.
	var directID int64
	if err := db.QueryRow(ctx, `
		INSERT INTO conversations(type,created_by,direct_key)
		VALUES('direct',$1,$2) RETURNING id
	`, users[0], fmt.Sprintf("e2ee-qa-%d", time.Now().UnixNano())).Scan(&directID); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", directID) }()
	for _, userID := range users[:2] {
		if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", directID, userID); err != nil {
			t.Fatal(err)
		}
	}
	directBase := fmt.Sprintf("/api/conversations/%d/e2ee", directID)
	directEvent := func(kind string, target string) mlsRelayInput {
		return signedMLSEvent(t, users[0], directID, 1, devices[0].id, kind, target, devices[0].key)
	}
	directCommit := directEvent("commit", "")
	directWelcome := directEvent("welcome", devices[1].id)
	bootstrap := map[string]any{"commit": directCommit, "welcome": directWelcome}
	if r := send(2, directBase+"/bootstrap", bootstrap, "POST"); r.Code != 403 {
		t.Fatalf("outsider could initialize direct MLS: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, directBase+"/events", directCommit, "POST"); r.Code != 409 {
		t.Fatalf("unsafe direct Commit without atomic Welcome accepted: %d %s", r.Code, r.Body.String())
	}
	bad := map[string]any{"commit": directCommit, "welcome": directEvent("welcome", devices[3].id)}
	if r := send(0, directBase+"/bootstrap", bad, "POST"); r.Code != 403 {
		t.Fatalf("outsider target Welcome accepted in bootstrap: %d %s", r.Code, r.Body.String())
	}
	var beforeEpoch int64
	if err := db.QueryRow(ctx, `SELECT COALESCE((SELECT epoch FROM e2ee_mls_groups WHERE conversation_id=$1),0)`, directID).Scan(&beforeEpoch); err != nil || beforeEpoch != 0 {
		t.Fatalf("invalid bootstrap changed epoch: %d %v", beforeEpoch, err)
	}
	if r := send(0, directBase+"/bootstrap", bootstrap, "POST"); r.Code != 409 {
		t.Fatalf("bootstrap without both consents was accepted: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, directBase+"/consents",
		map[string]any{"deviceId": devices[0].id}, "POST"); r.Code != 200 {
		t.Fatalf("first participant consent failed: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, directBase+"/bootstrap", bootstrap, "POST"); r.Code != 409 {
		t.Fatalf("bootstrap with only one consent was accepted: %d %s", r.Code, r.Body.String())
	}
	if r := send(2, directBase+"/consents",
		map[string]any{"deviceId": devices[3].id}, "POST"); r.Code != 403 {
		t.Fatalf("outsider consent succeeded: %d %s", r.Code, r.Body.String())
	}
	if r := send(1, directBase+"/consents",
		map[string]any{"deviceId": devices[1].id}, "POST"); r.Code != 200 {
		t.Fatalf("second participant consent failed: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, directBase+"/consents", nil, "GET"); r.Code != 200 ||
		!strings.Contains(r.Body.String(), `"ownApproved":true`) ||
		!strings.Contains(r.Body.String(), `"peerApproved":true`) {
		t.Fatalf("both consent statuses not confirmed: %d %s", r.Code, r.Body.String())
	}
	firstBootstrap := send(0, directBase+"/bootstrap", bootstrap, "POST")
	if firstBootstrap.Code != 201 {
		t.Fatalf("atomic bootstrap failed: %d %s", firstBootstrap.Code, firstBootstrap.Body.String())
	}
	if r := send(0, directBase+"/bootstrap", bootstrap, "POST"); r.Code != 200 || !strings.Contains(r.Body.String(), `"duplicate":true`) {
		t.Fatalf("lost-ACK bootstrap retry failed: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, directBase+"/bootstrap", map[string]any{
		"commit": directCommit, "welcome": directEvent("welcome", devices[1].id),
	}, "POST"); r.Code != 409 {
		t.Fatalf("conflicting bootstrap was not rejected: %d %s", r.Code, r.Body.String())
	}
	var eventCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM e2ee_mls_events WHERE conversation_id=$1`, directID).Scan(&eventCount); err != nil || eventCount != 2 {
		t.Fatalf("atomic bootstrap must store both events exactly once: %d %v", eventCount, err)
	}
	if r := send(0, directBase+"/events", directEvent("commit", ""), "POST"); r.Code != 409 {
		t.Fatalf("unverified pilot rekey accepted: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, directBase+"/events", directEvent("application", ""), "POST"); r.Code != 201 {
		t.Fatalf("pilot application rejected: %d %s", r.Code, r.Body.String())
	}
	if r := send(0, fmt.Sprintf("/api/conversations/%d/messages", directID),
		map[string]any{"text": "MUST NOT BE STORED", "clientId": testMLSUUID(t)}, "POST"); r.Code != 409 {
		t.Fatalf("plaintext after direct bootstrap accepted: %d %s", r.Code, r.Body.String())
	}
	receive := send(1, directBase+"/events?deviceId="+devices[1].id, nil, "GET")
	if receive.Code != 200 || !strings.Contains(receive.Body.String(), `"eventType":"welcome"`) {
		t.Fatalf("pilot peer could not receive Welcome: %d %s", receive.Code, receive.Body.String())
	}
	otherDevice := send(0, directBase+"/events?deviceId="+devices[0].id, nil, "GET")
	if otherDevice.Code != 200 || strings.Contains(otherDevice.Body.String(), `"eventType":"welcome"`) {
		t.Fatalf("targeted Welcome leaked to non-target device: %d %s", otherDevice.Code, otherDevice.Body.String())
	}

	// Auto-default is a DEV-only, empty direct conversation gate. It must
	// reject plaintext before any MLS group has been established, while
	// leaving old legacy history untouched and eligible for legacy sends.
	t.Setenv("CHATNET_E2EE_AUTO_DEFAULT", "1")
	var freshID int64
	if err := db.QueryRow(ctx, `
		INSERT INTO conversations(type,created_by,direct_key)
		VALUES('direct',$1,$2) RETURNING id
	`, users[0], fmt.Sprintf("e2ee-auto-%d", time.Now().UnixNano())).Scan(&freshID); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", freshID) }()
	for _, userID := range users[:2] {
		if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", freshID, userID); err != nil {
			t.Fatal(err)
		}
	}
	freshStatus := fmt.Sprintf("/api/conversations/%d/e2ee/status", freshID)
	freshMessages := fmt.Sprintf("/api/conversations/%d/messages", freshID)
	if result := send(0, freshStatus, nil, "GET"); result.Code != 200 ||
		!strings.Contains(result.Body.String(), `"autoEnabled":true`) {
		t.Fatalf("new direct room not selected for automatic E2EE: %d %s", result.Code, result.Body.String())
	}
	if result := send(0, freshMessages, map[string]any{
		"text": "CANNOT LEAK", "clientId": testMLSUUID(t),
	}, "POST"); result.Code != 409 {
		t.Fatalf("plaintext accepted in automatic E2EE room: %d %s", result.Code, result.Body.String())
	}
	var leaked int
	if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM messages WHERE conversation_id=$1", freshID).Scan(&leaked); err != nil || leaked != 0 {
		t.Fatalf("automatic E2EE allowed plaintext storage: count=%d err=%v", leaked, err)
	}

	var oldRoom int64
	if err := db.QueryRow(ctx, `
		INSERT INTO conversations(type,created_by,direct_key)
		VALUES('direct',$1,$2) RETURNING id
	`, users[0], fmt.Sprintf("e2ee-old-%d", time.Now().UnixNano())).Scan(&oldRoom); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(context.Background(), "DELETE FROM conversations WHERE id=$1", oldRoom) }()
	for _, userID := range users[:2] {
		if _, err := db.Exec(ctx, "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)", oldRoom, userID); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO messages(conversation_id,user_id,text) VALUES($1,$2,'old plaintext history')
	`, oldRoom, users[0]); err != nil {
		t.Fatal(err)
	}
	if status := send(0, fmt.Sprintf("/api/conversations/%d/e2ee/status", oldRoom), nil, "GET"); status.Code != 200 ||
		!strings.Contains(status.Body.String(), `"autoEnabled":false`) {
		t.Fatalf("historical conversation was incorrectly auto-converted: %d %s", status.Code, status.Body.String())
	}
	if status := send(0, fmt.Sprintf("/api/conversations/%d/messages", oldRoom), map[string]any{
		"text": "existing legacy room", "clientId": testMLSUUID(t),
	}, "POST"); status.Code != 201 {
		t.Fatalf("existing legacy history unexpectedly blocked: %d %s", status.Code, status.Body.String())
	}
}

func mustMLSDecode(t *testing.T, encoded string) []byte {
	t.Helper()
	out, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	return out
}
