package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLiveTranslationSetup(t *testing.T) {
	setup, ok := geminiLiveSetup("vi")["setup"].(map[string]any)
	if !ok {
		t.Fatal("setup object missing")
	}
	if setup["model"] != "models/gemini-3.5-live-translate-preview" {
		t.Fatal("wrong model")
	}
	config, ok := setup["generationConfig"].(map[string]any)
	if !ok {
		t.Fatal("missing generation config")
	}
	tr, ok := config["translationConfig"].(map[string]any)
	if !ok || tr["targetLanguageCode"] != "vi" {
		t.Fatal("target language missing")
	}
	if _, ok := config["inputAudioTranscription"]; !ok {
		t.Fatal("input transcript must be in generationConfig")
	}
	if _, ok := config["outputAudioTranscription"]; !ok {
		t.Fatal("output transcript must be in generationConfig")
	}
	if _, wrong := setup["inputAudioTranscription"]; wrong {
		t.Fatal("input transcript must not be a top-level setup field")
	}
	if _, wrong := setup["outputAudioTranscription"]; wrong {
		t.Fatal("output transcript must not be a top-level setup field")
	}
	raw, _ := json.Marshal(setup)
	if len(raw) == 0 {
		t.Fatal("empty setup")
	}
}
func TestTicketMustBeUniqueAndDoesNotContainCredentials(t *testing.T) {
	key1 := translationTicketKey("cnlt_test_ticket_one")
	key2 := translationTicketKey("cnlt_test_ticket_two")
	if key1 == key2 {
		t.Fatal("ticket hashes collide")
	}
	if key1 == "cnlt_test_ticket_one" {
		t.Fatal("ticket persisted raw")
	}
}
func TestTranslationOriginIsRestricted(t *testing.T) {
	r := httptest.NewRequest("GET", "https://api-chat.codelocal.cloud/api/calls/call_test/translation-stream", nil)
	r.Header.Set("Origin", "https://evil.example")
	if translationAllowedOrigin(r) {
		t.Fatal("untrusted origin allowed")
	}
	r.Header.Set("Origin", "https://chat.codelocal.cloud")
	if !translationAllowedOrigin(r) {
		t.Fatal("expected official web origin")
	}
}
func TestGeminiErrorCategoryDoesNotLeakProviderDetails(t *testing.T) {
	if message := publicGeminiLiveError(errGeminiQuota); message == "" || !strings.Contains(message, "quota") {
		t.Fatalf("expected actionable quota error, got %q", message)
	}
	if message := publicGeminiLiveError(errGeminiAccess); !strings.Contains(message, "API key") {
		t.Fatalf("expected access error, got %q", message)
	}
}

func TestRemoteSpeakerIdentityMustBeExact(t *testing.T) {
	for _, identity := range []string{"u_0", "u_-5", "u_42junk", "u_42/anything", "other_42", "u_"} {
		if _, ok := parseRemoteSpeakerID(identity); ok {
			t.Fatalf("invalid speaker identity accepted: %q", identity)
		}
	}
	if id, ok := parseRemoteSpeakerID("u_42"); !ok || id != 42 {
		t.Fatal("legitimate speaker identity was rejected")
	}
}

func TestTranslationTicketTTLIsShort(t *testing.T) {
	if translationTicketTTL > time.Minute {
		t.Fatal("ticket should not be long-lived")
	}
}

func TestTranslationStreamRejectsTicketInURL(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "https://api-chat.codelocal.cloud/api/calls/call_test/translation-stream?ticket=confidential", nil)
	request.Header.Set("Origin", "https://chat.codelocal.cloud")
	recorder := httptest.NewRecorder()
	(&server{}).streamCallTranslation(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("URL ticket must be rejected before websocket upgrade, got %d", recorder.Code)
	}
}

func TestTranslationStreamRejectsUntrustedOrigin(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "https://api-chat.codelocal.cloud/api/calls/call_test/translation-stream", nil)
	request.Header.Set("Origin", "https://untrusted.example")
	recorder := httptest.NewRecorder()
	(&server{}).streamCallTranslation(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("untrusted origin must be rejected before websocket upgrade, got %d", recorder.Code)
	}
}
