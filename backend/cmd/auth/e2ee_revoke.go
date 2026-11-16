package main

import (
	"crypto/ed25519"
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

type e2eeDeviceRevocation struct {
	AuthorizingDeviceID string `json:"authorizingDeviceId"`
	Challenge           string `json:"challenge"`
	Signature           string `json:"signature"`
}

func e2eeRevokeTranscript(userID int64, sessionID, targetDeviceID string, input e2eeDeviceRevocation) []byte {
	return []byte(strings.Join([]string{
		"chatnet:e2ee:device:revoke:v1", strconv.FormatInt(userID, 10),
		sessionID, targetDeviceID, input.AuthorizingDeviceID, input.Challenge,
	}, "\n"))
}

// Revocation is authorized by a still-active device signature, not just a
// stolen bearer token. Recovery when ALL private device keys are lost requires
// a separate, strongly authenticated process and is deliberately not offered.
func (s *server) revokeE2EEDevice(w http.ResponseWriter, r *http.Request) {
	if !e2eeExperimental(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "e2ee_device_revoke", fmt.Sprintf("user:%d", claims.UserID), 20, time.Hour) {
		return
	}
	targetID := r.PathValue("deviceId")
	if !e2eeDeviceIDRE.MatchString(targetID) {
		httpx.Error(w, http.StatusBadRequest, "invalid target device")
		return
	}
	var body e2eeDeviceRevocation
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF ||
		!e2eeDeviceIDRE.MatchString(body.AuthorizingDeviceID) {
		httpx.Error(w, http.StatusBadRequest, "invalid device revocation request")
		return
	}
	sig, sigErr := base64.RawURLEncoding.DecodeString(body.Signature)
	nonce, nonceErr := base64.RawURLEncoding.DecodeString(body.Challenge)
	if sigErr != nil || len(sig) != ed25519.SignatureSize ||
		base64.RawURLEncoding.EncodeToString(sig) != body.Signature ||
		nonceErr != nil || len(nonce) != 32 ||
		base64.RawURLEncoding.EncodeToString(nonce) != body.Challenge {
		httpx.Error(w, http.StatusBadRequest, "invalid device revocation signature")
		return
	}
	var public []byte
	err := s.db.QueryRow(r.Context(), `
		SELECT identity_key FROM e2ee_devices
		WHERE id=$1::uuid AND user_id=$2 AND revoked_at IS NULL
	`, body.AuthorizingDeviceID, claims.UserID).Scan(&public)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "authorizing device unavailable")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "device directory unavailable")
		return
	}
	if !ed25519.Verify(public, e2eeRevokeTranscript(claims.UserID, claims.SessionID, targetID, body), sig) {
		httpx.Error(w, http.StatusForbidden, "invalid device revocation proof")
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
		httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke device")
		return
	}
	defer tx.Rollback(r.Context())
	// Hold the authorizing identity throughout the revocation transaction.
	err = tx.QueryRow(r.Context(), `
		SELECT identity_key FROM e2ee_devices
		WHERE id=$1::uuid AND user_id=$2 AND revoked_at IS NULL FOR SHARE
	`, body.AuthorizingDeviceID, claims.UserID).Scan(&public)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusConflict, "authorizing device revoked")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify authorizing device")
		return
	}
	if !ed25519.Verify(public, e2eeRevokeTranscript(claims.UserID, claims.SessionID, targetID, body), sig) {
		httpx.Error(w, http.StatusForbidden, "device identity changed")
		return
	}
	var revokedID string
	err = tx.QueryRow(r.Context(), `
		UPDATE e2ee_devices SET revoked_at=NOW()
		WHERE id=$1::uuid AND user_id=$2 AND revoked_at IS NULL
		RETURNING id::text
	`, targetID, claims.UserID).Scan(&revokedID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "device not found or already revoked")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke device")
		return
	}
	if _, err = tx.Exec(r.Context(), `
		DELETE FROM e2ee_key_packages WHERE device_id=$1::uuid AND claimed_at IS NULL
	`, targetID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot invalidate KeyPackages")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot revoke device")
		return
	}
	// Critical: this invalidates unclaimed KeyPackages, NOT old MLS epoch keys.
	// Every enrolled conversation must rekey before the removed device loses
	// access to future encrypted content; release gate covers this separately.
	w.WriteHeader(http.StatusNoContent)
}
