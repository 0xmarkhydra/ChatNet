package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

// Bootstrap commits the first MLS epoch and its targeted Welcome ATOMICALLY.
// This pilot supports only a direct room with exactly one registered active
// device per participant. The server authenticates transport bytes; the
// receiving audited MLS client must still verify the actual MLS transcript.
type mlsBootstrapInput struct {
	Commit  mlsRelayInput `json:"commit"`
	Welcome mlsRelayInput `json:"welcome"`
}

type checkedBootstrapEvent struct {
	input       mlsRelayInput
	payload     []byte
	signature   []byte
	fingerprint [32]byte
}

func checkBootstrapEvent(input mlsRelayInput, senderUserID, conversationID int64, expectedType string, key []byte) (checkedBootstrapEvent, bool) {
	raw, err := base64.RawURLEncoding.DecodeString(input.Payload)
	sig, sigErr := base64.RawURLEncoding.DecodeString(input.Signature)
	if err != nil || sigErr != nil ||
		!mlsRelayUUID.MatchString(input.DeviceID) ||
		!mlsRelayUUID.MatchString(input.ClientID) ||
		input.EventType != expectedType || input.Epoch != 1 ||
		len(raw) < 32 || len(raw) > maxMLSRelayBytes ||
		base64.RawURLEncoding.EncodeToString(raw) != input.Payload ||
		len(sig) != ed25519.SignatureSize ||
		base64.RawURLEncoding.EncodeToString(sig) != input.Signature ||
		(expectedType == "commit" && input.TargetDeviceID != "") ||
		(expectedType == "welcome" && !mlsRelayUUID.MatchString(input.TargetDeviceID)) {
		return checkedBootstrapEvent{}, false
	}
	digest := sha256.Sum256(raw)
	transcript := mlsRelayTranscript(senderUserID, conversationID, input, digest)
	if !ed25519.Verify(key, transcript, sig) {
		return checkedBootstrapEvent{}, false
	}
	return checkedBootstrapEvent{input: input, payload: raw, signature: sig, fingerprint: sha256.Sum256(transcript)}, true
}

func (s *server) bootstrapMLSConversation(w http.ResponseWriter, r *http.Request) {
	if !mlsRelayEnabled(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if !s.allowMLSRelay(w, r, claims.UserID, "bootstrap", 12) {
		return
	}

	var body mlsBootstrapInput
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 360000))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF ||
		body.Commit.DeviceID != body.Welcome.DeviceID ||
		body.Commit.ClientID == body.Welcome.ClientID ||
		body.Welcome.DeviceID == body.Welcome.TargetDeviceID {
		httpx.Error(w, http.StatusBadRequest, "invalid MLS bootstrap envelope")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS bootstrap unavailable")
		return
	}
	defer tx.Rollback(r.Context())
	var roomType string
	if err = tx.QueryRow(r.Context(), `
    SELECT type FROM conversations WHERE id=$1 FOR UPDATE
  `, conversationID).Scan(&roomType); err != nil || roomType != "direct" {
		httpx.Error(w, http.StatusForbidden, "MLS pilot requires a direct conversation")
		return
	}
	var members, devices int
	if err = tx.QueryRow(r.Context(), `
    SELECT COUNT(*) FROM conversation_members WHERE conversation_id=$1
  `, conversationID).Scan(&members); err != nil || members != 2 {
		httpx.Error(w, http.StatusConflict, "MLS pilot requires exactly two members")
		return
	}
	if err = tx.QueryRow(r.Context(), `
    SELECT COUNT(*) FROM e2ee_devices d
    JOIN conversation_members cm ON cm.user_id=d.user_id
    WHERE cm.conversation_id=$1 AND d.revoked_at IS NULL
  `, conversationID).Scan(&devices); err != nil || devices != 2 {
		httpx.Error(w, http.StatusConflict, "MLS pilot requires one active device for each member")
		return
	}
	var senderPublicKey []byte
	if err = tx.QueryRow(r.Context(), `
    SELECT d.identity_key
    FROM e2ee_devices d
    JOIN conversation_members m ON m.user_id=d.user_id
    WHERE d.id=$1::uuid AND d.user_id=$2 AND d.revoked_at IS NULL
      AND m.conversation_id=$3
    FOR SHARE OF d,m
  `, body.Commit.DeviceID, claims.UserID, conversationID).Scan(&senderPublicKey); err != nil {
		httpx.Error(w, http.StatusForbidden, "MLS sender device is unauthorized")
		return
	}
	var targetOwner int64
	if err = tx.QueryRow(r.Context(), `
    SELECT d.user_id
    FROM e2ee_devices d
    JOIN conversation_members m ON m.user_id=d.user_id
    WHERE d.id=$1::uuid AND d.revoked_at IS NULL
      AND m.conversation_id=$2 AND d.user_id<>$3
    FOR SHARE OF d,m
  `, body.Welcome.TargetDeviceID, conversationID, claims.UserID).Scan(&targetOwner); err != nil {
		httpx.Error(w, http.StatusForbidden, "MLS recipient device is unauthorized")
		return
	}
	var consents int
	if err = tx.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM e2ee_pilot_consents pc
		JOIN e2ee_devices d ON d.id=pc.device_id AND d.user_id=pc.user_id
		WHERE pc.conversation_id=$1 AND d.revoked_at IS NULL AND
		 ((pc.user_id=$2 AND pc.device_id=$3::uuid) OR
		  (pc.user_id=$4 AND pc.device_id=$5::uuid))
	`, conversationID, claims.UserID, body.Commit.DeviceID, targetOwner,
		body.Welcome.TargetDeviceID).Scan(&consents); err != nil || consents != 2 {
		httpx.Error(w, http.StatusConflict, "both members must explicitly approve MLS pilot")
		return
	}
	commit, ok := checkBootstrapEvent(body.Commit, claims.UserID, conversationID, "commit", senderPublicKey)
	if !ok {
		httpx.Error(w, http.StatusForbidden, "invalid signed MLS Commit")
		return
	}
	welcome, ok := checkBootstrapEvent(body.Welcome, claims.UserID, conversationID, "welcome", senderPublicKey)
	if !ok {
		httpx.Error(w, http.StatusForbidden, "invalid signed MLS Welcome")
		return
	}

	// Lost ACK: return the original event IDs only if BOTH signed envelopes match.
	var existingCommit, existingWelcome int64
	var commitHash, welcomeHash []byte
	err1 := tx.QueryRow(r.Context(), `
    SELECT id,request_hash FROM e2ee_mls_events
    WHERE sender_device_id=$1::uuid AND client_id=$2::uuid
  `, commit.input.DeviceID, commit.input.ClientID).Scan(&existingCommit, &commitHash)
	err2 := tx.QueryRow(r.Context(), `
    SELECT id,request_hash FROM e2ee_mls_events
    WHERE sender_device_id=$1::uuid AND client_id=$2::uuid
  `, welcome.input.DeviceID, welcome.input.ClientID).Scan(&existingWelcome, &welcomeHash)
	if err1 == nil || err2 == nil {
		if err1 == nil && err2 == nil &&
			string(commitHash) == string(commit.fingerprint[:]) &&
			string(welcomeHash) == string(welcome.fingerprint[:]) {
			httpx.JSON(w, http.StatusOK, map[string]any{
				"commitId": existingCommit, "welcomeId": existingWelcome, "duplicate": true,
			})
			return
		}
		httpx.Error(w, http.StatusConflict, "MLS bootstrap idempotency conflict")
		return
	}
	if !errors.Is(err1, pgx.ErrNoRows) || !errors.Is(err2, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot reconcile MLS bootstrap")
		return
	}
	if _, err = tx.Exec(r.Context(), `
    INSERT INTO e2ee_mls_groups(conversation_id) VALUES($1)
    ON CONFLICT DO NOTHING
  `, conversationID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot initialize MLS group")
		return
	}
	var epoch int64
	if err = tx.QueryRow(r.Context(), `
    SELECT epoch FROM e2ee_mls_groups WHERE conversation_id=$1 FOR UPDATE
  `, conversationID).Scan(&epoch); err != nil || epoch != 0 {
		httpx.Error(w, http.StatusConflict, "MLS group already initialized")
		return
	}
	var commitID, welcomeID int64
	if err = tx.QueryRow(r.Context(), `
    INSERT INTO e2ee_mls_events (
      conversation_id,sender_user_id,sender_device_id,client_id,event_type,
      epoch,payload,signature,request_hash
    ) VALUES($1,$2,$3::uuid,$4::uuid,'commit',1,$5,$6,$7)
    RETURNING id
  `, conversationID, claims.UserID, commit.input.DeviceID, commit.input.ClientID,
		commit.payload, commit.signature, commit.fingerprint[:]).Scan(&commitID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot store MLS Commit")
		return
	}
	if err = tx.QueryRow(r.Context(), `
    INSERT INTO e2ee_mls_events (
      conversation_id,sender_user_id,sender_device_id,client_id,event_type,
      epoch,target_device_id,payload,signature,request_hash
    ) VALUES($1,$2,$3::uuid,$4::uuid,'welcome',1,$5::uuid,$6,$7,$8)
    RETURNING id
  `, conversationID, claims.UserID, welcome.input.DeviceID, welcome.input.ClientID,
		welcome.input.TargetDeviceID, welcome.payload, welcome.signature, welcome.fingerprint[:]).
		Scan(&welcomeID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot store MLS Welcome")
		return
	}
	if _, err = tx.Exec(r.Context(), `
    UPDATE e2ee_mls_groups SET epoch=1,updated_at=NOW() WHERE conversation_id=$1
  `, conversationID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot advance MLS epoch")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot commit MLS bootstrap")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"commitId": commitID, "welcomeId": welcomeID,
	})
}
