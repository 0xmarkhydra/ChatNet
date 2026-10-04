package main

import "testing"

func TestNormalizeAppLocale(t *testing.T) {
	for input, expected := range map[string]string{
		"":       "auto",
		" auto ": "auto",
		"VI":     "vi",
		"ja":     "ja",
		"ar":     "ar",
	} {
		got, ok := normalizeAppLocale(input)
		if !ok || got != expected {
			t.Fatalf("normalizeAppLocale(%q)=(%q,%v), want (%q,true)", input, got, ok, expected)
		}
	}

	for _, input := range []string{"xx", "eng", "vi-VN", "123"} {
		if got, ok := normalizeAppLocale(input); ok {
			t.Fatalf("normalizeAppLocale(%q)=(%q,true), want invalid", input, got)
		}
	}
}
