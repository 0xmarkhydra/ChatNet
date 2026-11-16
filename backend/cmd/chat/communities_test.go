package main

import (
	"strings"
	"testing"
)

func TestCommunityFieldsValidation(t *testing.T) {
	cases := []struct {
		name  string
		body  communityFields
		valid bool
	}{
		{"private", communityFields{Visibility: "private"}, true},
		{"public", communityFields{Description: "Nhóm công khai", Topic: "Công nghệ", Rules: "Không spam", Visibility: "public"}, true},
		{"missing visibility", communityFields{}, false},
		{"invalid visibility", communityFields{Visibility: "unlisted"}, false},
		{"too long description", communityFields{Visibility: "private", Description: strings.Repeat("a", 501)}, false},
		{"too long topic", communityFields{Visibility: "public", Topic: strings.Repeat("a", 101)}, false},
		{"too long rules", communityFields{Visibility: "public", Rules: strings.Repeat("a", 5001)}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := validCommunityFields(tc.body); got != tc.valid {
				t.Fatalf("valid=%v want %v", got, tc.valid)
			}
		})
	}
}
func TestChannelFieldsValidation(t *testing.T) {
	if !validChannel(channelFields{Name: "Thiết kế UI/UX", Description: "Kênh thảo luận"}) {
		t.Fatal("valid channel rejected")
	}
	for _, tc := range []channelFields{
		{Name: "  "}, {Name: strings.Repeat("a", 81)}, {Name: "Backend", Description: strings.Repeat("a", 501)},
	} {
		if validChannel(tc) {
			t.Fatalf("invalid channel accepted: %+v", tc)
		}
	}
}
func TestGroupMentionsMatchExactUsername(t *testing.T) {
	for _, tc := range []struct {
		message, username string
		want              bool
	}{
		{"Xin chào @LinhAnh!", "linhanh", true},
		{"Gặp @linhanh và @david", "david", true},
		{"@linhanh123", "linhanh", false},
		{"Đây là email linhanh@example.com", "linhanh", false},
		{"Câu chuyện không liên quan", "linhanh", false},
	} {
		if got := hasMention(tc.message, tc.username); got != tc.want {
			t.Fatalf("mention %q / %q = %v want %v", tc.message, tc.username, got, tc.want)
		}
	}
}
func TestChannelFingerprintIsolationAndLegacyCompatibility(t *testing.T) {
	legacy := messageRequestFingerprint(91, "hello", nil, nil)
	if legacy != messageRequestFingerprint(91, "hello", nil, nil, 0) {
		t.Fatal("general channel fingerprint changed")
	}
	channelA := messageRequestFingerprint(91, "hello", nil, nil, 201)
	channelB := messageRequestFingerprint(91, "hello", nil, nil, 202)
	if legacy == channelA || channelA == channelB {
		t.Fatal("channel IDs did not isolate idempotency")
	}
	if !sameMessageRequest(message{ConversationID: 91, ChannelID: 201, Text: "hello"}, 91, "hello", nil, nil, 201) {
		t.Fatal("channel retry failed")
	}
	if sameMessageRequest(message{ConversationID: 91, ChannelID: 201, Text: "hello"}, 91, "hello", nil, nil, 202) {
		t.Fatal("cross-channel retry accepted")
	}
}
