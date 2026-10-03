package main

import "testing"

func TestNormalizeUIBundleRequest(t *testing.T) {
	body, err := normalizeUIBundleRequest(uiBundleRequest{Locale: " JA ", Version: "v1", Messages: map[string]string{"nav.chat": "Tin nhắn"}})
	if err != nil {
		t.Fatal(err)
	}
	if body.Locale != "ja" {
		t.Fatalf("locale=%q", body.Locale)
	}
	if _, err := normalizeUIBundleRequest(uiBundleRequest{Locale: "xx", Version: "v1", Messages: map[string]string{"a": "b"}}); err == nil {
		t.Fatal("unsupported locale should fail")
	}
}

func TestParseUIBundlePreservesKeysAndFallbacks(t *testing.T) {
	source := map[string]string{"nav.chat": "Tin nhắn", "nav.profile": "Cá nhân"}
	got, err := parseUIBundle("```json\n{\"nav.chat\":\"Messages\"}\n```", source)
	if err != nil {
		t.Fatal(err)
	}
	if got["nav.chat"] != "Messages" {
		t.Fatalf("translated value=%q", got["nav.chat"])
	}
	if got["nav.profile"] != "Cá nhân" {
		t.Fatalf("fallback=%q", got["nav.profile"])
	}
	if len(got) != len(source) {
		t.Fatalf("unexpected key count=%d", len(got))
	}
}

func TestUIBundleCacheKeyIsOrderIndependent(t *testing.T) {
	a := uiBundleRequest{Locale: "en", Version: "v1", Messages: map[string]string{"a": "Một", "b": "Hai"}}
	b := uiBundleRequest{Locale: "en", Version: "v1", Messages: map[string]string{"b": "Hai", "a": "Một"}}
	if uiBundleCacheKey(a) != uiBundleCacheKey(b) {
		t.Fatal("cache key must be stable")
	}
}
