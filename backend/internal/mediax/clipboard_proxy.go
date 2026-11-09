package mediax

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const maxClipboardImageBytes int64 = 20 * 1024 * 1024

var (
	copyImagePath = regexp.MustCompile(`^/(?:[^/]+/)?chatnet/chat/[0-9]+/[0-9]{4}/[0-9]{2}/[a-fA-F0-9]{32}\.(?:png|jpg|jpeg|webp|gif|heic|heif)$`)
	copyImageSignature = regexp.MustCompile(`^[a-fA-F0-9]{64}$`)
)

// AllowedClipboardImageURL intentionally accepts only existing presigned chat
// images from the configured storage endpoint. Never create a general-purpose
// fetch proxy from a caller-controlled URL.
func AllowedClipboardImageURL(raw string) bool {
	if len(raw) == 0 || len(raw) > 8192 {
		return false
	}
	target, err := url.Parse(raw)
	if err != nil || target.Scheme != "https" || target.User != nil || target.Port() != "" {
		return false
	}
	host := strings.ToLower(target.Hostname())
	if host != "s3-hcm-r2.s3cloud.vn" && !strings.HasSuffix(host, ".s3-hcm-r2.s3cloud.vn") {
		return false
	}
	if target.Query().Get("X-Amz-Algorithm") != "AWS4-HMAC-SHA256" ||
		!copyImageSignature.MatchString(target.Query().Get("X-Amz-Signature")) {
		return false
	}
	decoded, err := url.PathUnescape(target.EscapedPath())
	return err == nil && copyImagePath.MatchString(decoded)
}

// ClipboardImageHandler serves signed, expiring chat-image contents on the
// same origin as the PWA. Remote object storage typically allows <img> but
// denies JavaScript readback without a matching CORS policy. The handler
// enforces a fixed storage host, strict object paths, signed URLs, no redirects,
// a timeout, MIME validation and a 20MB response limit.
func ClipboardImageHandler(client *http.Client) http.Handler {
	if client == nil {
		client = &http.Client{
			Timeout: 15 * time.Second,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		raw := r.URL.Query().Get("url")
		if !AllowedClipboardImageURL(raw) {
			http.Error(w, "image URL not allowed", http.StatusForbidden)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
		if err != nil {
			http.Error(w, "invalid image URL", http.StatusBadRequest)
			return
		}
		request.Header.Set("Accept", "image/*")
		response, err := client.Do(request)
		if err != nil {
			http.Error(w, "image download failed", http.StatusBadGateway)
			return
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			status := http.StatusBadGateway
			if response.StatusCode == http.StatusForbidden || response.StatusCode == http.StatusNotFound {
				status = response.StatusCode
			}
			http.Error(w, "image no longer accessible", status)
			return
		}
		mime := strings.TrimSpace(strings.ToLower(strings.Split(response.Header.Get("Content-Type"), ";")[0]))
		switch mime {
		case "image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif":
		default:
			http.Error(w, "invalid image content type", http.StatusUnsupportedMediaType)
			return
		}
		if response.ContentLength > maxClipboardImageBytes {
			http.Error(w, "image exceeds 20 MB", http.StatusRequestEntityTooLarge)
			return
		}
		data, err := io.ReadAll(io.LimitReader(response.Body, maxClipboardImageBytes+1))
		if err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "image read failed", http.StatusBadGateway)
			return
		}
		if int64(len(data)) > maxClipboardImageBytes {
			http.Error(w, "image exceeds 20 MB", http.StatusRequestEntityTooLarge)
			return
		}
		w.Header().Set("Content-Type", mime)
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	})
}
