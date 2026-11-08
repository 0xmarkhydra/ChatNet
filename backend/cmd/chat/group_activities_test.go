package main

import (
	"strings"
	"testing"
	"time"
)

func TestGroupActivityValidation(t *testing.T) {
	future := time.Now().Add(2 * time.Hour)
	past := time.Now().Add(-2 * time.Hour)
	cases := []struct {
		name  string
		value newGroupActivity
		valid bool
	}{
		{"poll", newGroupActivity{Kind: "poll", Title: "Đi đâu?", Options: []string{" Hà Nội ", "Sài Gòn"}}, true},
		{"duplicate option", newGroupActivity{Kind: "poll", Title: "Chọn", Options: []string{"A", " a "}}, false},
		{"one option", newGroupActivity{Kind: "poll", Title: "Chọn", Options: []string{"A"}}, false},
		{"eleven options", newGroupActivity{Kind: "poll", Title: "Chọn", Options: []string{"1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"}}, false},
		{"note", newGroupActivity{Kind: "note", Title: "Nội quy", Body: "Đọc trước khi tham gia"}, true},
		{"note cannot have options", newGroupActivity{Kind: "note", Title: "Ghi chú", Options: []string{"X"}}, false},
		{"reminder", newGroupActivity{Kind: "reminder", Title: "Họp nhóm", ScheduledAt: &future}, true},
		{"past reminder", newGroupActivity{Kind: "reminder", Title: "Họp nhóm", ScheduledAt: &past}, false},
		{"no reminder time", newGroupActivity{Kind: "reminder", Title: "Họp nhóm"}, false},
		{"missing title", newGroupActivity{Kind: "note", Title: "    "}, false},
		{"oversized text", newGroupActivity{Kind: "note", Title: "Ghi chú", Body: strings.Repeat("x", 5001)}, false},
		{"wrong kind", newGroupActivity{Kind: "delete", Title: "Không hợp lệ"}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			actual := validGroupActivity(&tc.value)
			if actual != tc.valid {
				t.Fatalf("valid=%v, want %v", actual, tc.valid)
			}
			if actual && tc.value.Kind == "poll" && tc.value.Options[0] != "Hà Nội" && tc.name == "poll" {
				t.Fatal("poll options were not trimmed")
			}
		})
	}
}
