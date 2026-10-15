package main

import (
	"encoding/json"
	"net/http/httptest"
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
		t.Fatal("input transcript disabled")
	}
	if _, ok := config["outputAudioTranscription"]; !ok {
		t.Fatal("output transcript disabled")
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
func TestTranslationTicketTTLIsShort(t *testing.T) {
	if translationTicketTTL > time.Minute {
		t.Fatal("ticket should not be long-lived")
	}
}
