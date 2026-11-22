package main

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestScheduledMessageValidation(t *testing.T) {
	for _, tc := range []struct {
		name string
		text string
		id   string
		ch   int64
		want error
	}{
		{"plain", "  hẹn giờ  ", "schedule-1", 0, nil},
		{"max size", strings.Repeat("á", 2000), "schedule-1", 12, nil},
		{"blank", " \n ", "schedule-1", 0, errScheduledBody},
		{"over size", strings.Repeat("á", 2001), "schedule-1", 0, errScheduledBody},
		{"invalid UTF-8", "\xff", "schedule-1", 0, errScheduledBody},
		{"PostgreSQL NUL", "a\x00b", "schedule-1", 0, errScheduledBody},
		{"client id required", "hello", "", 0, errScheduledID},
		{"channel", "hello", "schedule-1", -1, errScheduledRoom},
	} {
		t.Run(tc.name, func(t *testing.T) {
			in := scheduleMessageInput{Text: tc.text, ClientID: tc.id, Channel: tc.ch}
			if err := in.normalize(); !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}

func TestScheduledMessageClockAndFingerprint(t *testing.T) {
	now := time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC)
	local := time.Date(2026, 11, 20, 9, 0, 0, 999, time.FixedZone("UTC+7", 7*60*60))
	at, err := scheduleTime(local, now)
	if err != nil || at.Location() != time.UTC || !at.Equal(now.Add(2*time.Hour)) {
		t.Fatalf("wrong scheduled instant %s, %v", at, err)
	}
	for _, invalid := range []time.Time{now, now.Add(-time.Second), now.Add(maxScheduleLeadTime + time.Second)} {
		if _, err := scheduleTime(invalid, now); !errors.Is(err, errScheduledTime) {
			t.Fatalf("expected invalid time, got %v", err)
		}
	}
	for _, valid := range []time.Time{now.Add(time.Microsecond), now.Add(maxScheduleLeadTime)} {
		if _, err := scheduleTime(valid, now); err != nil {
			t.Fatalf("boundary should be accepted: %v", err)
		}
	}
	a := scheduleMessageInput{Text: "hello", ClientID: "schedule-1", SendAt: local}
	b := scheduleMessageInput{Text: " hello ", ClientID: "schedule-1", SendAt: at}
	for _, in := range []*scheduleMessageInput{&a, &b} {
		if err := in.normalize(); err != nil {
			t.Fatal(err)
		}
	}
	if a.fingerprint(1) != b.fingerprint(1) || a.fingerprint(1) == b.fingerprint(2) {
		t.Fatal("fingerprint must normalize clock offsets and bind the conversation")
	}
	b.Channel = 12
	if a.fingerprint(1) == b.fingerprint(1) {
		t.Fatal("fingerprint must bind the channel")
	}
}
