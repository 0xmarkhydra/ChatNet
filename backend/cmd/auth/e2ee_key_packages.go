package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

const (
	e2eeMaxPackageBytes = 16384
	e2eePackageTTL      = 7 * 24 * time.Hour
	e2eeAvailableLimit  = 30
)

type e2eePackagePublish struct {
	DeviceID  string `json:"deviceId"`
	PackageID string `json:"packageId"`
	Package   string `json:"package"`
	Challenge string `json:"challenge"`
	Signature string `json:"signature"`
}

type e2eePackageClaim struct {
	DeviceID string `json:"deviceId"`
	UserID   int64  `json:"userId"`
}

type e2eeClaimedPackage struct {
	UserID    int64     `json:"userId"`
	DeviceID  string    `json:"deviceId"`
	PackageID string    `json:"packageId"`
	Package   string    `json:"package"`
	SessionID string    `json:"sessionId"`
	Challenge string    `json:"challenge"`
	Signature string    `json:"signature"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func e2eePackageTranscript(userID int64, sessionID string, input e2eePackagePublish, hash [32]byte) []byte {
	return []byte(strings.Join([]string{
		"chatnet:e2ee:keypackage:publish:v1",
		strconv.FormatInt(userID, 10), sessionID, input.DeviceID, input.PackageID,
		base64.RawURLEncoding.EncodeToString(hash[:]), input.Challenge,
	}, "\n"))
}

func decodeE2EEPublish(w http.ResponseWriter, r *http.Request) (e2eePackagePublish, []byte, []byte, [32]byte, bool) {
	var input e2eePackagePublish
	var zero [32]byte
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 24576))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid KeyPackage request")
		return input, nil, nil, zero, false
	}
	raw, packageErr := base64.RawURLEncoding.DecodeString(input.Package)
	sig, signatureErr := base64.RawURLEncoding.DecodeString(input.Signature)
	nonce, challengeErr := base64.RawURLEncoding.DecodeString(input.Challenge)
	if !e2eeDeviceIDRE.MatchString(input.DeviceID) ||
		!e2eeDeviceIDRE.MatchString(input.PackageID) ||
		packageErr != nil || len(raw) < 64 || len(raw) > e2eeMaxPackageBytes ||
		base64.RawURLEncoding.EncodeToString(raw) != input.Package ||
		signatureErr != nil || len(sig) != ed25519.SignatureSize ||
		base64.RawURLEncoding.EncodeToString(sig) != input.Signature ||
		challengeErr != nil || len(nonce) != 32 ||
		base64.RawURLEncoding.EncodeToString(nonce) != input.Challenge {
		httpx.Error(w, http.StatusBadRequest, "invalid KeyPackage encoding")
		return input, nil, nil, zero, false
	}
	return input, raw, sig, sha256.Sum256(raw), true
}

// Package bytes are opaque to this delivery service. MLS clients MUST independently
// validate the KeyPackage signature, credential binding, protocol version and ciphersuite
// before using it to add a device. Transport authorization is not MLS validation.
func (s *server) publishE2EEKeyPackage(w http.ResponseWriter, r *http.Request) {
	if !e2eeExperimental(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "e2ee_kp_publish", fmt.Sprintf("user:%d", claims.UserID), 60, time.Hour) {
		return
	}
	body, raw, sig, hash, ok := decodeE2EEPublish(w, r)
	if !ok {
		return
	}
	var key []byte
	err := s.db.QueryRow(r.Context(), `
		SELECT identity_key FROM e2ee_devices
		WHERE id=$1::uuid AND user_id=$2 AND revoked_at IS NULL
	`, body.DeviceID, claims.UserID).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "device not registered")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "device registry unavailable")
		return
	}
	if !ed25519.Verify(key, e2eePackageTranscript(claims.UserID, claims.SessionID, body, hash), sig) {
		httpx.Error(w, http.StatusForbidden, "invalid device signature")
		return
	}
	if s.redis == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "challenge store unavailable")
		return
	}
	used, err := s.redis.GetDel(r.Context(), e2eeChallengeKey(claims, body.Challenge)).Result()
	if err != nil || used != "1" {
		if err != nil && !errors.Is(err, redis.Nil) {
			httpx.Error(w, http.StatusServiceUnavailable, "challenge store unavailable")
		} else {
			httpx.Error(w, http.StatusConflict, "challenge expired or already used")
		}
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot publish KeyPackage")
		return
	}
	defer tx.Rollback(r.Context())
	// Device row lock serializes quota checks, revocation and concurrent publishes.
	err = tx.QueryRow(r.Context(), `
		SELECT identity_key FROM e2ee_devices
		WHERE id=$1::uuid AND user_id=$2 AND revoked_at IS NULL FOR UPDATE
	`, body.DeviceID, claims.UserID).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "device revoked")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify device")
		return
	}
	if !ed25519.Verify(key, e2eePackageTranscript(claims.UserID, claims.SessionID, body, hash), sig) {
		httpx.Error(w, http.StatusForbidden, "device identity changed")
		return
	}
	var count int
	if err = tx.QueryRow(r.Context(), `
		SELECT count(*) FROM e2ee_key_packages
		WHERE device_id=$1::uuid AND claimed_at IS NULL AND expires_at>NOW()
	`, body.DeviceID).Scan(&count); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot count KeyPackages")
		return
	}
	if count >= e2eeAvailableLimit {
		httpx.Error(w, http.StatusConflict, "KeyPackage limit reached")
		return
	}
	var expires time.Time
	challengeBytes, _ := base64.RawURLEncoding.DecodeString(body.Challenge) // validated at decode boundary
	err = tx.QueryRow(r.Context(), `
		INSERT INTO e2ee_key_packages(
			id,device_id,package_bytes,package_hash,expires_at,
			publisher_session_id,publication_challenge,publication_signature
		)
		VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7,$8)
		ON CONFLICT DO NOTHING RETURNING expires_at
	`, body.PackageID, body.DeviceID, raw, hash[:], time.Now().Add(e2eePackageTTL),
		claims.SessionID, challengeBytes, sig).Scan(&expires)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusConflict, "KeyPackage already exists")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot publish KeyPackage")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot publish KeyPackage")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"deviceId": body.DeviceID, "packageId": body.PackageID, "expiresAt": expires,
	})
}

func decodeE2EEClaim(w http.ResponseWriter, r *http.Request) (e2eePackageClaim, bool) {
	var body e2eePackageClaim
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF ||
		!e2eeDeviceIDRE.MatchString(body.DeviceID) || body.UserID <= 0 {
		httpx.Error(w, http.StatusBadRequest, "invalid KeyPackage claim")
		return body, false
	}
	return body, true
}

func (s *server) claimE2EEKeyPackage(w http.ResponseWriter, r *http.Request) {
	if !e2eeExperimental(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "e2ee_kp_claim", fmt.Sprintf("user:%d", claims.UserID), 120, time.Hour) {
		return
	}
	body, ok := decodeE2EEClaim(w, r)
	if !ok {
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot claim KeyPackage")
		return
	}
	defer tx.Rollback(r.Context())
	// Authorize the caller against the target device owner. Lock the target
	// row so a concurrent revocation cannot race the one-time claim.
	var owner int64
	err = tx.QueryRow(r.Context(), `
		SELECT d.user_id
		FROM e2ee_devices d
		WHERE d.id=$1::uuid AND d.user_id=$2 AND d.revoked_at IS NULL
		  AND ($3=$2 OR EXISTS (
		    SELECT 1 FROM conversation_members own
		    JOIN conversation_members peer ON peer.conversation_id=own.conversation_id
		    WHERE own.user_id=$3 AND peer.user_id=$2
		  ))
		FOR SHARE OF d
	`, body.DeviceID, body.UserID, claims.UserID).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "KeyPackage unavailable")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot authorize KeyPackage claim")
		return
	}
	var result e2eeClaimedPackage
	var raw, challengeBytes, signatureBytes []byte
	err = tx.QueryRow(r.Context(), `
		WITH chosen AS (
			SELECT id FROM e2ee_key_packages
			WHERE device_id=$1::uuid AND claimed_at IS NULL AND expires_at>NOW()
			  AND publisher_session_id IS NOT NULL AND publication_challenge IS NOT NULL
			  AND publication_signature IS NOT NULL
			ORDER BY created_at,id
			FOR UPDATE SKIP LOCKED LIMIT 1
		)
		UPDATE e2ee_key_packages p
		SET claimed_at=NOW(),claimed_by=$2
		FROM chosen WHERE p.id=chosen.id
		RETURNING p.id::text,p.device_id::text,p.package_bytes,p.expires_at,
				  p.publisher_session_id::text,p.publication_challenge,p.publication_signature
	`, body.DeviceID, claims.UserID).Scan(
		&result.PackageID, &result.DeviceID, &raw, &result.ExpiresAt,
		&result.SessionID, &challengeBytes, &signatureBytes)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusConflict, "no available KeyPackage")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot claim KeyPackage")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot claim KeyPackage")
		return
	}
	result.UserID = owner
	result.Package = base64.RawURLEncoding.EncodeToString(raw)
	result.Challenge = base64.RawURLEncoding.EncodeToString(challengeBytes)
	result.Signature = base64.RawURLEncoding.EncodeToString(signatureBytes)
	httpx.JSON(w, http.StatusOK, result)
}
