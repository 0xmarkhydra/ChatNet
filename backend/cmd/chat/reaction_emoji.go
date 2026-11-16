package main

import (
	"unicode/utf8"
)

// validChatReactionEmoji accepts a single Unicode emoji (including variation
// selectors, skin tones, flags, and ZWJ sequences) rather than a hard-coded
// shortlist. Reject ordinary text and multiple unrelated emojis.
func validChatReactionEmoji(value string) bool {
	if value == "" || len(value) > 64 || !utf8.ValidString(value) || utf8.RuneCountInString(value) > 12 {
		return false
	}
	baseCount, regionalCount := 0, 0
	hasJoiner := false
	var previous rune
	for _, r := range value {
		switch {
		case r == 0x200d: // zero-width joiner: combines two emoji
			if previous == 0 || previous == 0x200d {
				return false
			}
			hasJoiner = true
		case r == 0xfe0f || r == 0xfe0e: // presentation selector
			if previous == 0 || previous == 0x200d {
				return false
			}
		case r >= 0x1f3fb && r <= 0x1f3ff: // skin tone modifier
			if previous == 0 || previous == 0x200d {
				return false
			}
		case isChatEmojiBase(r):
			baseCount++
			if r >= 0x1f1e6 && r <= 0x1f1ff {
				regionalCount++
			}
		default:
			return false
		}
		previous = r
	}
	if previous == 0x200d || baseCount == 0 {
		return false
	}
	return baseCount == 1 || hasJoiner || (baseCount == 2 && regionalCount == 2)
}

func isChatEmojiBase(r rune) bool {
	return (r >= 0x1f000 && r <= 0x1faff) ||
		(r >= 0x2600 && r <= 0x27bf) ||
		r == 0x00a9 || r == 0x00ae || r == 0x203c ||
		r == 0x2049 || r == 0x2122 || r == 0x2139
}
