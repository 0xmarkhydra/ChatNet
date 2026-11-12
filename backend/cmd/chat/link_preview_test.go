package main

import (
	"net"
	"net/url"
	"strings"
	"testing"
)

func TestLinkPreviewURLSafety(t *testing.T) {
	tests := []struct {
		raw     string
		allowed bool
	}{
		{"https://plane.codelocal.cloud/", true},
		{"https://example.com/blog", true},
		{"http://localhost/admin", false},
		{"https://localhost./", false},
		{"http://127.0.0.1:80/", false},
		{"http://[::1]/", false},
		{"http://server.internal/", false},
		{"https://example.com:8080/", false},
		{"https://user:password@example.com/", false},
		{"file:///etc/passwd", false},
	}
	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			u, err := url.Parse(tt.raw)
			if err != nil {
				t.Fatal(err)
			}
			if got := validPreviewURL(u); got != tt.allowed {
				t.Fatalf("validPreviewURL(%q) = %v; want %v", tt.raw, got, tt.allowed)
			}
		})
	}
}

func TestLinkPreviewBlockedIPs(t *testing.T) {
	for _, ip := range []string{"127.0.0.1", "10.0.0.2", "169.254.169.254", "100.64.1.1", "203.0.113.1", "::1", "fc00::1", "2001:db8::1"} {
		if publicPreviewIP(net.ParseIP(ip)) {
			t.Errorf("restricted IP was allowed: %s", ip)
		}
	}
	for _, ip := range []string{"8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"} {
		if !publicPreviewIP(net.ParseIP(ip)) {
			t.Errorf("public IP was rejected: %s", ip)
		}
	}
}

func TestParseLinkPreviewOpenGraph(t *testing.T) {
	page, _ := url.Parse("https://example.com/posts/123")
	html := `<!doctype html><html><head>
	<title>Fallback title</title>
	<meta property="og:title" content="Bài viết minh họa">
	<meta property="og:description" content="Mô tả ngắn &amp; hữu ích">
	<meta property="og:image" content="/covers/123.jpg">
	<meta property="og:site_name" content="Example">
	</head><body>Content</body></html>`
	got := parseLinkPreview(strings.NewReader(html), page)
	if got.Title != "Bài viết minh họa" || got.Description != "Mô tả ngắn & hữu ích" {
		t.Errorf("incorrect text metadata: %+v", got)
	}
	if got.Image != "https://example.com/covers/123.jpg" || got.SiteName != "Example" {
		t.Errorf("incorrect image/site metadata: %+v", got)
	}
}

func TestParseLinkPreviewFallback(t *testing.T) {
	page, _ := url.Parse("https://example.com")
	got := parseLinkPreview(strings.NewReader(`<head><title> Trang đơn giản </title><meta name="description" content="Nội dung"></head>`), page)
	if got.Title != "Trang đơn giản" || got.Description != "Nội dung" {
		t.Errorf("expected HTML title/description fallback, got: %+v", got)
	}
}
