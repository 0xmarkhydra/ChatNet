package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

const (
	e2eeChallengeTTL = 2 * time.Minute
	e2eeDeviceLimit  = 12
)

var e2eeDeviceIDRE = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

type e2eeDeviceRegistration struct {
	DeviceID    string `json:"deviceId"`
	IdentityKey string `json:"identityKey"`
	Signature   string `json:"signature"`
	Challenge   string `json:"challenge"`
	Label       string `json:"label"`
}

type e2eePublicDevice struct {
	DeviceID    string    `json:"deviceId"`
	IdentityKey string    `json:"identityKey"`
	Label       string    `json:"label"`
	CreatedAt   time.Time `json:"createdAt"`
}

func e2eeExperimental(w http.ResponseWriter) bool {
	if config.Env("CHATNET_E2EE_EXPERIMENTAL", "") != "1" {
		httpx.Error(w, http.StatusNotFound, "not found")
		return false
	}
	w.Header().Set("Cache-Control", "no-store")
	return true
}

func e2eeChallengeKey(claims *authx.Claims, challenge string) string {
	return fmt.Sprintf("chatnet:e2ee:challenge:%d:%s:%s", claims.UserID, claims.SessionID, challenge)
}

// Stable transcript: client signs with its non-exportable Ed25519 identity key.
// Account JWT is checked independently by CachedSessionMiddleware.
func e2eeRegistrationTranscript(userID int64, sessionID string, body e2eeDeviceRegistration) []byte {
	return []byte(strings.Join([]string{
		"chatnet:e2ee:register:v1", strconv.FormatInt(userID, 10),
		sessionID, body.DeviceID, body.IdentityKey, body.Challenge, body.Label,
	}, "\n"))
}

func decodeE2EERegistration(w http.ResponseWriter, r *http.Request) (e2eeDeviceRegistration, ed25519.PublicKey, []byte, bool) {
	var body e2eeDeviceRegistration
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid device registration")
		return body, nil, nil, false
	}
	key, keyErr := base64.RawURLEncoding.DecodeString(body.IdentityKey)
	sig, sigErr := base64.RawURLEncoding.DecodeString(body.Signature)
	nonce, nonceErr := base64.RawURLEncoding.DecodeString(body.Challenge)
	if !e2eeDeviceIDRE.MatchString(body.DeviceID) ||
		keyErr != nil || len(key) != ed25519.PublicKeySize || base64.RawURLEncoding.EncodeToString(key) != body.IdentityKey ||
		sigErr != nil || len(sig) != ed25519.SignatureSize || base64.RawURLEncoding.EncodeToString(sig) != body.Signature ||
		nonceErr != nil || len(nonce) != 32 || base64.RawURLEncoding.EncodeToString(nonce) != body.Challenge ||
		strings.TrimSpace(body.Label) != body.Label || len(body.Label) > 80 {
		httpx.Error(w, http.StatusBadRequest, "invalid E2EE device identity")
		return body, nil, nil, false
	}
	return body, ed25519.PublicKey(key), sig, true
}

func (s *server) newE2EEChallenge(w http.ResponseWriter, r *http.Request) {
	if !e2eeExperimental(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "e2ee_challenge", fmt.Sprintf("user:%d", claims.UserID), 20, 10*time.Minute) {
		return
	}
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot issue challenge")
		return
	}
	challenge := base64.RawURLEncoding.EncodeToString(random)
	if s.redis == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "challenge store unavailable")
		return
	}
	if err := s.redis.Set(r.Context(), e2eeChallengeKey(claims, challenge), "1", e2eeChallengeTTL).Err(); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "challenge store unavailable")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"challenge": challenge, "sessionId": claims.SessionID, "expiresInSeconds": int(e2eeChallengeTTL.Seconds())})
}

func (s *server) registerE2EEDevice(w http.ResponseWriter, r *http.Request) {
	if !e2eeExperimental(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "e2ee_device_register", fmt.Sprintf("user:%d", claims.UserID), 30, time.Hour) {
		return
	}
	body, publicKey, signature, ok := decodeE2EERegistration(w, r)
	if !ok {
		return
	}
	if !ed25519.Verify(publicKey, e2eeRegistrationTranscript(claims.UserID, claims.SessionID, body), signature) {
		httpx.Error(w, http.StatusForbidden, "invalid device ownership proof")
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
		httpx.Error(w, http.StatusServiceUnavailable, "cannot register device")
		return
	}
	defer tx.Rollback(r.Context())

	// Serialize registrations by locking the owner row, so the per-user quota
	// cannot be bypassed with concurrent valid challenges.
	var owner int64
	if err = tx.QueryRow(r.Context(), "SELECT id FROM users WHERE id=$1 FOR UPDATE", claims.UserID).Scan(&owner); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot verify device owner")
		return
	}
	var count int
	if err = tx.QueryRow(r.Context(), "SELECT count(*) FROM e2ee_devices WHERE user_id=$1 AND revoked_at IS NULL", claims.UserID).Scan(&count); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot count devices")
		return
	}
	if count >= e2eeDeviceLimit {
		httpx.Error(w, http.StatusConflict, "device limit reached")
		return
	}
	var created time.Time
	err = tx.QueryRow(r.Context(), `
		INSERT INTO e2ee_devices(id,user_id,identity_key,label)
		VALUES($1::uuid,$2,$3,$4)
		ON CONFLICT DO NOTHING
		RETURNING created_at`, body.DeviceID, claims.UserID, []byte(publicKey), body.Label).Scan(&created)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusConflict, "device identity is already registered")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot register device")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot register device")
		return
	}
	httpx.JSON(w, http.StatusCreated, e2eePublicDevice{
		DeviceID: body.DeviceID, IdentityKey: body.IdentityKey, Label: body.Label, CreatedAt: created,
	})
}

func (s *server) listE2EEDevices(w http.ResponseWriter, r *http.Request) {
	if !e2eeExperimental(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "e2ee_directory", fmt.Sprintf("user:%d", claims.UserID), 300, 5*time.Minute) {
		return
	}
	target := claims.UserID
	if r.PathValue("userId") != "" {
		var err error
		target, err = strconv.ParseInt(r.PathValue("userId"), 10, 64)
		if err != nil || target <= 0 {
			httpx.Error(w, http.StatusBadRequest, "invalid user")
			return
		}
	}
	// No public directory scraping. A peer's keys become discoverable only
	// after both users have a shared conversation; self lookup always works.
	if target != claims.UserID {
		var allowed bool
		err := s.db.QueryRow(r.Context(), `
			SELECT EXISTS(
				SELECT 1 FROM conversation_members viewer
				JOIN conversation_members peer ON peer.conversation_id=viewer.conversation_id
				WHERE viewer.user_id=$1 AND peer.user_id=$2
			)`, claims.UserID, target).Scan(&allowed)
		if err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot verify membership")
			return
		}
		if !allowed {
			httpx.Error(w, http.StatusNotFound, "E2EE devices unavailable")
			return
		}
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT id::text, identity_key, label, created_at
		FROM e2ee_devices
		WHERE user_id=$1 AND revoked_at IS NULL
		ORDER BY created_at,id LIMIT $2`, target, e2eeDeviceLimit)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot list E2EE devices")
		return
	}
	defer rows.Close()
	result := make([]e2eePublicDevice, 0)
	for rows.Next() {
		var item e2eePublicDevice
		var key []byte
		if err = rows.Scan(&item.DeviceID, &key, &item.Label, &item.CreatedAt); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot list E2EE devices")
			return
		}
		item.IdentityKey = base64.RawURLEncoding.EncodeToString(key)
		result = append(result, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot list E2EE devices")
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}
