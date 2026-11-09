package main

import (
	"strings"
	"testing"
)

func TestNormalizeProfileShortText(t *testing.T) {
	cases := []struct {
		name  string
		value string
		max   int
		want  string
		valid bool
	}{
		{"empty", "", 160, "", true},
		{"trim unicode bio", "  Yêu công nghệ và du lịch 🌿  ", 160, "Yêu công nghệ và du lịch 🌿", true},
		{"city", " Hà Nội, Việt Nam ", 100, "Hà Nội, Việt Nam", true},
		{"max rune count", strings.Repeat("ắ", 100), 100, strings.Repeat("ắ", 100), true},
		{"too many characters", strings.Repeat("é", 101), 100, "", false},
		{"newline injection", "Hà Nội\nKhông hợp lệ", 100, "", false},
		{"tab", "Hồ\tsơ", 160, "", false},
		{"control character", "Hồ\x00sơ", 160, "", false},
		{"invalid UTF8", string([]byte{0xff, 0xfe}), 160, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizeProfileShortText(tc.value, tc.max, "trường hồ sơ")
			if (err == nil) != tc.valid {
				t.Fatalf("normalizeProfileShortText(%q) err=%v, want valid=%t", tc.value, err, tc.valid)
			}
			if tc.valid && got != tc.want {
				t.Fatalf("normalized value=%q, want=%q", got, tc.want)
			}
		})
	}
}
