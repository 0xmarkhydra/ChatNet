package main

import "testing"

func TestNormalizeProfileUsername(t *testing.T) {
	username, err := normalizeProfileUsername(" Mong.LV-36 ")
	if err != nil {
		t.Fatalf("valid username rejected: %v", err)
	}
	if username != "mong.lv-36" {
		t.Fatalf("unexpected normalized username: %q", username)
	}

	for _, value := range []string{"mo", "-mong", "mong_", "mông", "mong lv"} {
		if _, err := normalizeProfileUsername(value); err == nil {
			t.Fatalf("invalid username accepted: %q", value)
		}
	}
}

func TestNormalizeProfileDisplayName(t *testing.T) {
	displayName, err := normalizeProfileDisplayName("  Lê Văn Mong  ")
	if err != nil {
		t.Fatalf("valid display name rejected: %v", err)
	}
	if displayName != "Lê Văn Mong" {
		t.Fatalf("unexpected display name: %q", displayName)
	}

	for _, value := range []string{"", "   ", "Mong\nAdmin"} {
		if _, err := normalizeProfileDisplayName(value); err == nil {
			t.Fatalf("invalid display name accepted: %q", value)
		}
	}
}
