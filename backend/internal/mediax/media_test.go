package mediax

import "testing"

func TestClassifyProfileOnlyAcceptsImages(t *testing.T) {
	kind, maxBytes, err := classify("profile", "avatar.jpg", "image/jpeg")
	if err != nil {
		t.Fatalf("profile image rejected: %v", err)
	}
	if kind != "image" {
		t.Fatalf("unexpected profile kind: %q", kind)
	}
	if maxBytes != 12*1024*1024 {
		t.Fatalf("unexpected profile image limit: %d", maxBytes)
	}

	if _, _, err := classify("profile", "cover.mp4", "video/mp4"); err == nil {
		t.Fatal("profile video should be rejected")
	}
}
