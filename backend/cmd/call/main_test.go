package main

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestSecureIDIsOpaqueAndValid(t *testing.T) {
	id, err := secureID("call_", 16)
	if err != nil {
		t.Fatal(err)
	}
	if !validOpaqueID(id, "call_") {
		t.Fatalf("generated id is not valid: %q", id)
	}
	if len(id) != len("call_")+32 {
		t.Fatalf("unexpected id length: %d", len(id))
	}
	if validOpaqueID("call_1234", "call_") {
		t.Fatal("short call id must be rejected")
	}
}

func TestLiveKitRequiresSecureServerURL(t *testing.T) {
	base := server{
		liveKitAPIKey:    "api-key",
		liveKitAPISecret: "0123456789abcdef",
	}
	base.liveKitURL = "ws://rtc.example.test"
	if base.liveKitConfigured() {
		t.Fatal("insecure websocket URL must not be accepted")
	}
	base.liveKitURL = "https://rtc.example.test"
	if base.liveKitConfigured() {
		t.Fatal("non-WebSocket LiveKit URL must not be accepted")
	}
	base.liveKitURL = "wss://rtc.example.test"
	if !base.liveKitConfigured() {
		t.Fatal("secure LiveKit configuration should be accepted")
	}
}

func TestLiveKitJoinTokenHasMinimalRoomGrant(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	s := server{
		liveKitURL:       "wss://rtc.example.test",
		liveKitAPIKey:    "api-key",
		liveKitAPISecret: secret,
	}
	room := "cn_0123456789abcdef0123456789abcdef"
	identity := participantIdentity(42)
	raw, err := s.liveKitJoinToken(room, identity)
	if err != nil {
		t.Fatal(err)
	}

	token, err := jwt.Parse(raw, func(token *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		t.Fatalf("token verification failed: %v", err)
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("unexpected claims type")
	}
	if claims["sub"] != identity {
		t.Fatalf("unexpected identity: %#v", claims["sub"])
	}
	video, ok := claims["video"].(map[string]any)
	if !ok {
		t.Fatalf("missing video grant: %#v", claims["video"])
	}
	if video["room"] != room || video["roomJoin"] != true {
		t.Fatalf("unexpected room grant: %#v", video)
	}
	if video["canPublish"] != true || video["canSubscribe"] != true || video["canPublishData"] != true {
		t.Fatalf("unexpected media permissions: %#v", video)
	}
	for key, value := range claims {
		if strings.Contains(strings.ToLower(key), "secret") || value == secret {
			t.Fatalf("secret material leaked into token claim %q", key)
		}
	}
}

func TestParticipantIdentityContainsNoProfileData(t *testing.T) {
	if got := participantIdentity(987); got != "u_987" {
		t.Fatalf("unexpected participant identity: %q", got)
	}
}

func TestE2EEPublicKeyValidationOnlyAcceptsP256(t *testing.T) {
	coordinate := base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	valid := publicJWK{Kty: "EC", Crv: "P-256", X: coordinate, Y: coordinate}
	if !validP256PublicJWK(valid) {
		t.Fatal("valid P-256 JWK must be accepted")
	}
	valid.Crv = "P-384"
	if validP256PublicJWK(valid) {
		t.Fatal("non P-256 keys must be rejected")
	}
}

func TestEncryptedEnvelopeBounds(t *testing.T) {
	iv := base64.RawURLEncoding.EncodeToString(make([]byte, 12))
	ciphertext := base64.RawURLEncoding.EncodeToString(make([]byte, 48))
	if !validEnvelope(iv, ciphertext) {
		t.Fatal("bounded AES-GCM envelope must be accepted")
	}
	if validEnvelope(base64.RawURLEncoding.EncodeToString(make([]byte, 8)), ciphertext) {
		t.Fatal("non-96-bit GCM IV must be rejected")
	}
	if validEnvelope(iv, base64.RawURLEncoding.EncodeToString(make([]byte, 4096))) {
		t.Fatal("oversized envelope must be rejected")
	}
}

func TestKeyGenerationIdentifierIsConstrained(t *testing.T) {
	if !validGeneration("x7Nf_9Yp-12") {
		t.Fatal("opaque generation id should be accepted")
	}
	if validGeneration("contains spaces") || validGeneration("../../secret") || validGeneration("short") {
		t.Fatal("unsafe generation ids must be rejected")
	}
}
