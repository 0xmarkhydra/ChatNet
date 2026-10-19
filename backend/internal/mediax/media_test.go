package mediax

import "testing"

func TestClassifyRejectsDisguisedExecutableMedia(t *testing.T) {
	cases := []struct {
		name     string
		fileName string
		mime     string
	}{
		{"SVG masked as JPEG", "photo.jpg", "image/svg+xml"},
		{"HTML masked as PDF", "invoice.pdf", "text/html"},
		{"JavaScript masked as ZIP", "backup.zip", "application/javascript"},
		{"SVG masked as WebP", "art.webp", "image/svg+xml"},
		{"QuickTime masked as MP4", "clip.mp4", "video/quicktime"},
		{"PDF masked as image", "photo.png", "application/pdf"},
		{"unknown active document", "report.docx", "application/xhtml+xml"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, _, err := classify("chat", tc.fileName, tc.mime); err == nil {
				t.Errorf("unsafe extension/MIME combination was accepted: %s %s", tc.fileName, tc.mime)
			}
		})
	}
}

func TestClassifyAcceptsStandardBrowserMediaMIME(t *testing.T) {
	cases := []struct {
		name     string
		fileName string
		mime     string
		kind     string
	}{
		{"JPEG", "photo.jpg", "image/jpeg", "image"},
		{"iPhone HEIC", "photo.heic", "image/heic", "image"},
		{"MP4", "movie.mp4", "video/mp4", "video"},
		{"voice note", "voice.m4a", "audio/mp4", "audio"},
		{"PDF", "invoice.pdf", "application/pdf", "file"},
		{"Word", "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file"},
		{"CSV", "table.csv", "text/csv; charset=utf-8", "file"},
		{"unknown browser MIME", "draft.zip", "application/octet-stream", "file"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			kind, _, err := classify("chat", tc.fileName, tc.mime)
			if err != nil || kind != tc.kind {
				t.Errorf("expected kind %s, got %s err %v", tc.kind, kind, err)
			}
		})
	}
}

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
