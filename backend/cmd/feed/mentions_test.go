package main

import (
	"reflect"
	"testing"
)

func TestTaggedUsernames(t *testing.T) {
	cases := []struct {
		name, content string
		want          []string
	}{
		{"plain", "Hello @alice", nil},
		{"tagged", "👥 Cùng với @alice, @bob\nHello", []string{"alice", "bob"}},
		{"checkin", "📍 Hà Nội\n👥 Cùng với @alice\n😊 Đang cảm thấy vui vẻ", []string{"alice"}},
		{"duplicate", "👥 Cùng với @alice, @ALICE, @bob", []string{"alice", "bob"}},
		{"notfirst", "Hello\n👥 Cùng với @alice", nil},
		{"malformed", "👥 Cùng với @alice, no-name", nil},
		{"empty", "👥 Cùng với ", nil},
		{"too-many", "👥 Cùng với @a, @b, @c, @d, @e, @f, @g, @h, @i, @j, @k", nil},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if got := taggedUsernames(test.content); !reflect.DeepEqual(got, test.want) {
				t.Fatalf("got %v, want %v", got, test.want)
			}
		})
	}
}
