package main

import (
	"testing"
	"time"
)

func TestSearchDateBoundsUsesBrowserLocalDay(t *testing.T) {
	from, err := time.Parse("2006-01-02", "2026-10-28")
	if err != nil {
		t.Fatal(err)
	}
	start, end := searchDateBounds(&from, &from, -420) // UTC+07:00 (Vietnam)
	wantStart := time.Date(2026, 10, 27, 17, 0, 0, 0, time.UTC)
	wantEnd := time.Date(2026, 10, 28, 17, 0, 0, 0, time.UTC)
	if !start.Equal(wantStart) || !end.Equal(wantEnd) {
		t.Fatalf("bounds = [%s, %s), want [%s, %s)", start, end, wantStart, wantEnd)
	}
	start, end = searchDateBounds(nil, nil, -420)
	if !start.IsZero() || !end.IsZero() {
		t.Fatalf("empty filters should have no bounds")
	}
}
