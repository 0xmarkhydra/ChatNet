package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestE2EERevocationProofBoundToDeviceSessionAndOwner(t *testing.T) {
	uid := int64(123)
	sid := testE2EEID(t)
	target := testE2EEID(t)
	authorizer := testE2EEID(t)
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	proof := e2eeDeviceRevocation{
		AuthorizingDeviceID: authorizer,
		Challenge:           base64.RawURLEncoding.EncodeToString(make([]byte, 32)),
	}
	sig := ed25519.Sign(private, e2eeRevokeTranscript(uid, sid, target, proof))
	if !ed25519.Verify(public, e2eeRevokeTranscript(uid, sid, target, proof), sig) ||
		ed25519.Verify(public, e2eeRevokeTranscript(uid+1, sid, target, proof), sig) ||
		ed25519.Verify(public, e2eeRevokeTranscript(uid, testE2EEID(t), target, proof), sig) ||
		ed25519.Verify(public, e2eeRevokeTranscript(uid, sid, testE2EEID(t), proof), sig) {
		t.Fatal("device revocation proof did not bind every authorization field")
	}
	proof.AuthorizingDeviceID = testE2EEID(t)
	if ed25519.Verify(public, e2eeRevokeTranscript(uid, sid, target, proof), sig) {
		t.Fatal("revocation authorizer ID was not covered by signature")
	}
}

func TestE2EERevocationFeatureDisabled(t *testing.T) {
	t.Setenv("CHATNET_E2EE_EXPERIMENTAL", "")
	s := &server{}
	req := httptest.NewRequest("POST", "/api/auth/e2ee/devices/invalid/revoke", strings.NewReader("{}"))
	w := httptest.NewRecorder()
	s.revokeE2EEDevice(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("revocation endpoint available without flag: %d", w.Code)
	}
}
