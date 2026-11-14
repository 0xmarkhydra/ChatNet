package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/httpx"
	"chatnet/internal/ratelimit"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const maxMLSRelayBytes = 131072

var mlsRelayUUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

type mlsRelayInput struct {
	DeviceID       string `json:"deviceId"`
	ClientID       string `json:"clientId"`
	EventType      string `json:"eventType"`
	Epoch          int64  `json:"epoch"`
	TargetDeviceID string `json:"targetDeviceId,omitempty"`
	Payload        string `json:"payload"`
	Signature      string `json:"signature"`
}

type mlsRelayEvent struct {
	ID             int64     `json:"id"`
	ConversationID int64     `json:"conversationId"`
	DeviceID       string    `json:"deviceId"`
	SenderID       int64     `json:"senderId"`
	ClientID       string    `json:"clientId"`
	EventType      string    `json:"eventType"`
	Epoch          int64     `json:"epoch"`
	TargetDeviceID string    `json:"targetDeviceId,omitempty"`
	Payload        string    `json:"payload"`
	Signature      string    `json:"signature"`
	CreatedAt      time.Time `json:"createdAt"`
}

func mlsRelayEnabled(w http.ResponseWriter) bool {
	w.Header().Set("Cache-Control", "no-store")
	if config.Env("CHATNET_E2EE_EXPERIMENTAL", "") != "1" {
		httpx.Error(w, http.StatusNotFound, "not found")
		return false
	}
	return true
}

// Signed transport transcript is NOT a replacement for MLS-internal message
// validation. The receiving MLS engine must verify epochs, credentials and
// membership independently of any account or device claimed by this server.
func mlsRelayTranscript(userID, conversationID int64, input mlsRelayInput, digest [32]byte) []byte {
	return []byte(strings.Join([]string{
		"chatnet:e2ee:mls:relay:v1",
		strconv.FormatInt(userID, 10), strconv.FormatInt(conversationID, 10),
		input.DeviceID, input.ClientID, input.EventType, strconv.FormatInt(input.Epoch, 10),
		input.TargetDeviceID, base64.RawURLEncoding.EncodeToString(digest[:]),
	}, "\n"))
}

func decodeMLSRelayInput(w http.ResponseWriter, r *http.Request) (mlsRelayInput, []byte, []byte, [32]byte, bool) {
	var input mlsRelayInput
	var empty [32]byte
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 180000))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid MLS envelope")
		return input, nil, nil, empty, false
	}
	payload, payloadErr := base64.RawURLEncoding.DecodeString(input.Payload)
	signature, signatureErr := base64.RawURLEncoding.DecodeString(input.Signature)
	if !mlsRelayUUID.MatchString(input.DeviceID) ||
		!mlsRelayUUID.MatchString(input.ClientID) ||
		input.Epoch < 1 ||
		(input.EventType != "commit" && input.EventType != "application" && input.EventType != "welcome") ||
		(input.EventType == "welcome" && !mlsRelayUUID.MatchString(input.TargetDeviceID)) ||
		(input.EventType != "welcome" && input.TargetDeviceID != "") ||
		payloadErr != nil || len(payload) < 32 || len(payload) > maxMLSRelayBytes ||
		base64.RawURLEncoding.EncodeToString(payload) != input.Payload ||
		signatureErr != nil || len(signature) != ed25519.SignatureSize ||
		base64.RawURLEncoding.EncodeToString(signature) != input.Signature {
		httpx.Error(w, http.StatusBadRequest, "invalid MLS envelope fields")
		return input, nil, nil, empty, false
	}
	return input, payload, signature, sha256.Sum256(payload), true
}

func (s *server) allowMLSRelay(w http.ResponseWriter, r *http.Request, userID int64, scope string, limit int64) bool {
	if s.redis == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS relay rate limiter unavailable")
		return false
	}
	ok, _, err := (ratelimit.Limiter{Redis: s.redis}).Allow(
		r.Context(), "e2ee_mls_"+scope, strconv.FormatInt(userID, 10), limit, time.Minute)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS relay rate limiter unavailable")
		return false
	}
	if !ok {
		w.Header().Set("Retry-After", "60")
		httpx.Error(w, http.StatusTooManyRequests, "MLS relay rate limit exceeded")
		return false
	}
	return true
}

// guardPlaintextDuringMLS shares a parent conversation lock with MLS publishes.
// This is a transitional fail-closed guard: after the first MLS Commit, legacy
// POST /messages must NEVER persist a new plaintext message for that room.
func (s *server) guardPlaintextDuringMLS(w http.ResponseWriter, r *http.Request, tx pgx.Tx, conversationID int64) bool {
	var roomType string
	if err := tx.QueryRow(r.Context(), `
		SELECT type FROM conversations WHERE id=$1 FOR SHARE
	`, conversationID).Scan(&roomType); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify conversation encryption mode")
		return false
	}
	var encrypted bool
	if err := tx.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1 FROM e2ee_mls_groups
			WHERE conversation_id=$1 AND epoch>0
		)
	`, conversationID).Scan(&encrypted); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify conversation encryption mode")
		return false
	}
	if encrypted {
		httpx.Error(w, http.StatusConflict, "this conversation requires end-to-end encrypted messages")
		return false
	}
	// Default E2EE pilot is limited to *empty* direct chats. Existing legacy
	// history is never silently converted, and server must never accept a
	// plaintext first message for an auto-encrypted room. The conversation
	// FOR SHARE lock is held through the caller's transaction commit.
	if roomType == "direct" && mlsAutoDefaultEnabled() {
		var historyExists bool
		if err := tx.QueryRow(r.Context(), `
			SELECT EXISTS (SELECT 1 FROM messages WHERE conversation_id=$1)
		`, conversationID).Scan(&historyExists); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot check legacy message history")
			return false
		}
		if !historyExists {
			httpx.Error(w, http.StatusConflict, "E2EE setup required before sending direct messages")
			return false
		}
	}
	return true
}

func mlsAutoDefaultEnabled() bool {
	return config.Env("CHATNET_E2EE_EXPERIMENTAL", "") == "1" &&
		config.Env("CHATNET_E2EE_AUTO_DEFAULT", "") == "1"
}

func (s *server) getMLSConversationStatus(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.isMember(r.Context(), conversationID, claims.UserID) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}
	var roomType string
	var epoch int64
	var hasHistory bool
	// Status snapshot must use the same parent lock as the plaintext sender
	// and MLS bootstrap to avoid informing the UI of an impossible state.
	err := s.db.QueryRow(r.Context(), `
		SELECT c.type,
			COALESCE(g.epoch, 0),
			EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id)
		FROM conversations c
		LEFT JOIN e2ee_mls_groups g ON g.conversation_id=c.id
		WHERE c.id=$1
	`, conversationID).Scan(&roomType, &epoch, &hasHistory)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "encryption status unavailable")
		return
	}
	mode := "legacy"
	if epoch > 0 {
		mode = "e2ee"
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{
		"mode": mode, "epoch": epoch,
		"pilotEnabled": config.Env("CHATNET_E2EE_EXPERIMENTAL", "") == "1",
		"autoEnabled":  mlsAutoDefaultEnabled() && roomType == "direct" && !hasHistory && epoch == 0,
	})
}

func (s *server) publishMLSEvent(w http.ResponseWriter, r *http.Request) {
	if !mlsRelayEnabled(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.allowMLSRelay(w, r, claims.UserID, "publish", 240) {
		return
	}
	if !s.allowDirectConversation(w, r, conversationID, claims.UserID) {
		return
	}
	input, payload, signature, digest, ok := decodeMLSRelayInput(w, r)
	if !ok {
		return
	}
	original := mlsRelayTranscript(claims.UserID, conversationID, input, digest)
	fingerprint := sha256.Sum256(original)

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS relay unavailable")
		return
	}
	defer tx.Rollback(r.Context())

	// Parent row serialization prevents legacy plaintext sends racing the
	// very first MLS Commit. Legacy senders hold FOR SHARE on this same row.
	var conversationType string
	if err = tx.QueryRow(r.Context(), `
		SELECT type FROM conversations WHERE id=$1 FOR UPDATE
	`, conversationID).Scan(&conversationType); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot lock MLS conversation")
		return
	}

	var membership int64
	err = tx.QueryRow(r.Context(), `
		SELECT conversation_id FROM conversation_members
		WHERE conversation_id=$1 AND user_id=$2 FOR SHARE
	`, conversationID, claims.UserID).Scan(&membership)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "membership unavailable")
		return
	}
	// Lock the sender device to prevent concurrent revocation or key swap.
	var publicKey []byte
	err = tx.QueryRow(r.Context(), `
		SELECT identity_key FROM e2ee_devices
		WHERE id=$1::uuid AND user_id=$2 AND revoked_at IS NULL FOR SHARE
	`, input.DeviceID, claims.UserID).Scan(&publicKey)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusForbidden, "device not registered or revoked")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "device directory unavailable")
		return
	}
	if !ed25519.Verify(publicKey, original, signature) {
		httpx.Error(w, http.StatusForbidden, "invalid device signature")
		return
	}
	// Serialize event epochs and all retries against this single group row.
	if _, err = tx.Exec(r.Context(), `
		INSERT INTO e2ee_mls_groups(conversation_id) VALUES($1)
		ON CONFLICT DO NOTHING
	`, conversationID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot initialize MLS relay")
		return
	}
	var currentEpoch int64
	if err = tx.QueryRow(r.Context(), `
		SELECT epoch FROM e2ee_mls_groups WHERE conversation_id=$1 FOR UPDATE
	`, conversationID).Scan(&currentEpoch); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS relay unavailable")
		return
	}

	// Idempotency comes before epoch checks because a successful Commit changes
	// the epoch; a lost-ACK retry must return its original ID, not a false 409.
	var existingID int64
	var existingHash []byte
	err = tx.QueryRow(r.Context(), `
		SELECT id,request_hash FROM e2ee_mls_events
		WHERE sender_device_id=$1::uuid AND client_id=$2::uuid
	`, input.DeviceID, input.ClientID).Scan(&existingID, &existingHash)
	if err == nil {
		if string(existingHash) != string(fingerprint[:]) {
			httpx.Error(w, http.StatusConflict, "clientId already used for a different MLS event")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"id": existingID, "epoch": input.Epoch, "duplicate": true})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot resolve MLS retry")
		return
	}

	if conversationType == "direct" && (input.EventType != "application" || currentEpoch != 1) {
		httpx.Error(w, http.StatusConflict, "direct MLS pilot permits only applications after atomic bootstrap")
		return
	}
	if input.EventType == "commit" {
		if input.Epoch != currentEpoch+1 {
			httpx.Error(w, http.StatusConflict, "MLS commit epoch mismatch")
			return
		}
	} else if currentEpoch < 1 || input.Epoch != currentEpoch {
		httpx.Error(w, http.StatusConflict, "MLS group epoch mismatch")
		return
	}
	// Welcome is device-targeted; never allow senders to address outsiders.
	if input.EventType == "welcome" {
		var target int64
		err = tx.QueryRow(r.Context(), `
			SELECT d.user_id FROM e2ee_devices d
			JOIN conversation_members m ON m.user_id=d.user_id
			WHERE d.id=$1::uuid AND d.revoked_at IS NULL AND m.conversation_id=$2
			FOR SHARE OF d,m
		`, input.TargetDeviceID, conversationID).Scan(&target)
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusForbidden, "target device not in conversation")
			return
		}
		if err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot authorize target device")
			return
		}
	}
	var id int64
	var created time.Time
	err = tx.QueryRow(r.Context(), `
		INSERT INTO e2ee_mls_events(
			conversation_id,sender_user_id,sender_device_id,client_id,event_type,
			epoch,target_device_id,payload,signature,request_hash
		) VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6,NULLIF($7::text,'')::uuid,$8,$9,$10)
		RETURNING id,created_at
	`, conversationID, claims.UserID, input.DeviceID, input.ClientID,
		input.EventType, input.Epoch, input.TargetDeviceID, payload, signature, fingerprint[:]).
		Scan(&id, &created)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.Error(w, http.StatusConflict, "duplicate MLS event clientId")
		} else {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot store MLS event")
		}
		return
	}
	if input.EventType == "commit" {
		if _, err = tx.Exec(r.Context(), `
			UPDATE e2ee_mls_groups SET epoch=$2,updated_at=NOW()
			WHERE conversation_id=$1
		`, conversationID, input.Epoch); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot commit MLS epoch")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot commit MLS event")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"id": id, "epoch": input.Epoch, "createdAt": created})
}

func (s *server) listMLSEvents(w http.ResponseWriter, r *http.Request) {
	if !mlsRelayEnabled(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.allowMLSRelay(w, r, claims.UserID, "list", 120) {
		return
	}
	deviceID := r.URL.Query().Get("deviceId")
	if !mlsRelayUUID.MatchString(deviceID) {
		httpx.Error(w, http.StatusBadRequest, "invalid device")
		return
	}
	after := int64(0)
	if value := r.URL.Query().Get("after"); value != "" {
		var err error
		after, err = strconv.ParseInt(value, 10, 64)
		if err != nil || after < 0 {
			httpx.Error(w, http.StatusBadRequest, "invalid MLS event cursor")
			return
		}
	}
	limit := 25
	if value := r.URL.Query().Get("limit"); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil || n < 1 || n > 50 {
			httpx.Error(w, http.StatusBadRequest, "invalid MLS event limit")
			return
		}
		limit = n
	}
	// Authorize the active receiving device AND current DB membership. This is
	// also rechecked by the delivery SQL, preventing an intervening revocation.
	var authorized bool
	err := s.db.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM conversation_members m
			JOIN e2ee_devices d ON d.user_id=m.user_id
			WHERE m.conversation_id=$1 AND m.user_id=$2
			  AND d.id=$3::uuid AND d.revoked_at IS NULL
		)
	`, conversationID, claims.UserID, deviceID).Scan(&authorized)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot authorize MLS recipient")
		return
	}
	if !authorized {
		httpx.Error(w, http.StatusForbidden, "MLS recipient not authorized")
		return
	}
	var currentEpoch int64
	err = s.db.QueryRow(r.Context(), `
		SELECT epoch FROM e2ee_mls_groups WHERE conversation_id=$1
	`, conversationID).Scan(&currentEpoch)
	if errors.Is(err, pgx.ErrNoRows) {
		currentEpoch = 0
	} else if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot load MLS epoch")
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT e.id,e.sender_user_id,e.sender_device_id::text,e.client_id::text,
			   e.event_type,e.epoch,COALESCE(e.target_device_id::text,''),
			   e.payload,e.signature,e.created_at
		FROM e2ee_mls_events e
		WHERE e.conversation_id=$1 AND e.id>$2
		  AND (e.event_type<>'welcome' OR e.target_device_id=$3::uuid)
		  AND EXISTS(
			SELECT 1 FROM conversation_members cm
			JOIN e2ee_devices d ON cm.user_id=d.user_id
			WHERE cm.conversation_id=$1 AND cm.user_id=$4
			  AND d.id=$3::uuid AND d.revoked_at IS NULL
		  )
		ORDER BY e.id LIMIT $5
	`, conversationID, after, deviceID, claims.UserID, limit)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot load MLS events")
		return
	}
	defer rows.Close()
	result := make([]mlsRelayEvent, 0, limit)
	for rows.Next() {
		var item mlsRelayEvent
		var payload, signature []byte
		if err = rows.Scan(&item.ID, &item.SenderID, &item.DeviceID, &item.ClientID,
			&item.EventType, &item.Epoch, &item.TargetDeviceID,
			&payload, &signature, &item.CreatedAt); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot load MLS event")
			return
		}
		item.ConversationID = conversationID
		item.Payload = base64.RawURLEncoding.EncodeToString(payload)
		item.Signature = base64.RawURLEncoding.EncodeToString(signature)
		result = append(result, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS event stream unavailable")
		return
	}
	nextAfter := after
	if len(result) > 0 {
		nextAfter = result[len(result)-1].ID
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"events": result, "nextAfter": nextAfter, "currentEpoch": currentEpoch,
	})
}
