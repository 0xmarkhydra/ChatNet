package main

import "testing"

func TestValidChatReactionEmoji(t *testing.T) {
	tests := []struct {
		emoji string
		valid bool
	}{
		{"👍", true},
		{"❤️", true},
		{"🩷", true},
		{"🦄", true},
		{"✌️", true},
		{"👩🏽‍💻", true},
		{"🇻🇳", true},
		{"", false},
		{"hello", false},
		{"👍👍", false},
		{"👍\n", false},
		{"\u200d👍", false},
	}
	for _, test := range tests {
		if got := validChatReactionEmoji(test.emoji); got != test.valid {
			t.Errorf("validChatReactionEmoji(%q) = %v, want %v", test.emoji, got, test.valid)
		}
	}
}
