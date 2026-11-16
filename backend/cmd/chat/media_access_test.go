package main

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestChatMediaTicketsAreScopedAndExpire(t *testing.T) {
	s := &server{jwtSecret: "media-secret"}
	raw := s.mediaTicket(48, 12)
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(parsed.Path, "/api/media/chat/48") {
		t.Fatalf("invalid path: %s", parsed.Path)
	}
	viewer, valid := s.verifyMediaTicket(48, parsed.Query())
	if !valid || viewer != 12 {
		t.Fatalf("valid ticket rejected, viewer=%d", viewer)
	}
	if _, valid := s.verifyMediaTicket(49, parsed.Query()); valid {
		t.Fatal("ticket replays on another attachment")
	}
	for _, tc := range []struct{ name, key, value string }{
		{"different viewer", "viewer", "13"},
		{"expired", "expires", "1"},
		{"too far in future", "expires", "9999999999"},
		{"bad signature", "sig", "00"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			params := parsed.Query()
			params.Set(tc.key, tc.value)
			if _, valid := s.verifyMediaTicket(48, params); valid {
				t.Fatal("invalid ticket accepted")
			}
		})
	}
	dup := parsed.Query()
	dup.Add("viewer", "12")
	if _, valid := s.verifyMediaTicket(48, dup); valid {
		t.Fatal("duplicate viewer accepted")
	}
	differentSecret := &server{jwtSecret: "another-secret"}
	if _, valid := differentSecret.verifyMediaTicket(48, parsed.Query()); valid {
		t.Fatal("ticket signed by different key accepted")
	}
}

func TestOrphanCleanupRetention(t *testing.T) {
	now := time.Now().UTC()
	if eligibleChatOrphan(now.Add(-time.Hour), now) {
		t.Fatal("new upload marked orphan")
	}
	if eligibleChatOrphan(now.Add(-6*24*time.Hour), now) {
		t.Fatal("offline draft before retention marked orphan")
	}
	if !eligibleChatOrphan(now.Add(-8*24*time.Hour), now) {
		t.Fatal("old orphan not eligible")
	}
	if eligibleChatOrphan(time.Time{}, now) {
		t.Fatal("zero timestamp accepted")
	}
	if eligibleChatOrphan(now.Add(time.Hour), now) {
		t.Fatal("future timestamp accepted")
	}
}
