package mediax

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

const testClipboardImageURL = "https://s3-hcm-r2.s3cloud.vn/bucket/chatnet/chat/12/2026/11/0123456789abcdef0123456789abcdef.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=" +
	"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestAllowedClipboardImageURL(t *testing.T) {
	if !AllowedClipboardImageURL(testClipboardImageURL) {
		t.Fatal("valid signed chat image should be allowed")
	}
	cases := []string{
		"http://s3-hcm-r2.s3cloud.vn/bucket/chatnet/chat/12/2026/11/file.png",
		"https://127.0.0.1/private?X-Amz-Signature=" + strings.Repeat("a", 64),
		strings.Replace(testClipboardImageURL, "s3-hcm-r2.s3cloud.vn", "evil.example", 1),
		strings.Replace(testClipboardImageURL, "/chatnet/chat/", "/chatnet/feed/", 1),
		strings.Replace(testClipboardImageURL, "X-Amz-Algorithm=AWS4-HMAC-SHA256", "X-Amz-Algorithm=wrong", 1),
		strings.Replace(testClipboardImageURL, "X-Amz-Signature="+strings.Repeat("a", 64), "X-Amz-Signature=invalid", 1),
	}
	for _, input := range cases {
		if AllowedClipboardImageURL(input) {
			t.Errorf("rejected URL passed: %q", input)
		}
	}
}

func TestClipboardImageHandler(t *testing.T) {
	image := []byte{137, 80, 78, 71}
	calls := 0
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			calls++
			if r.URL.String() != testClipboardImageURL || r.Method != http.MethodGet {
				t.Fatalf("unexpected upstream request")
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(bytes.NewReader(image)),
				Header: http.Header{"Content-Type": []string{"image/png"}},
				ContentLength: int64(len(image)),
			}, nil
		}),
	}
	handler := ClipboardImageHandler(client)
	path := "/__chatnet_copy_image?url=" + url.QueryEscape(testClipboardImageURL)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	if rec.Code != http.StatusOK || !bytes.Equal(rec.Body.Bytes(), image) {
		t.Fatalf("image read failed: HTTP %d", rec.Code)
	}
	if rec.Header().Get("Cache-Control") != "private, no-store" ||
		rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("sensitive clipboard images must be served without cache/sniffing")
	}
	if calls != 1 {
		t.Fatalf("expected one upstream request, got %d", calls)
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet,
		"/__chatnet_copy_image?url="+url.QueryEscape("http://127.0.0.1:8080/secret"), nil))
	if rec.Code != http.StatusForbidden || calls != 1 {
		t.Fatal("must reject SSRF without network access")
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("unexpected method status: %d", rec.Code)
	}
}

func TestClipboardImageHandlerRejectsNonImage(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader("<html>danger</html>")),
				Header: http.Header{"Content-Type": []string{"text/html"}},
			}, nil
		}),
	}
	rec := httptest.NewRecorder()
	ClipboardImageHandler(client).ServeHTTP(rec, httptest.NewRequest(http.MethodGet,
		"/__chatnet_copy_image?url="+url.QueryEscape(testClipboardImageURL), nil))
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected HTTP 415 for non-image, got %d", rec.Code)
	}
}
