package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/objectstore"
)

func TestMediaUploadRelay(t *testing.T) {
	var storedPath, storedBody, storedType string
	storageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("S3 method = %s, want PUT", r.Method)
		}
		storedPath = r.URL.Path
		storedType = r.Header.Get("Content-Type")
		payload, _ := io.ReadAll(r.Body)
		storedBody = string(payload)
		w.WriteHeader(http.StatusOK)
	}))
	defer storageServer.Close()
	t.Setenv("S3_ENDPOINT", storageServer.URL)
	t.Setenv("S3_BUCKET", "testbucket")
	t.Setenv("S3_REGION", "us-east-1")
	t.Setenv("S3_ACCESS_KEY_ID", "test-key")
	t.Setenv("S3_SECRET_ACCESS_KEY", "test-secret")
	t.Setenv("S3_FORCE_PATH_STYLE", "true")

	s := &server{storage: objectstore.NewFromEnv(), jwtSecret: "relay-test-secret"}
	accessToken, err := authx.Sign("relay-test-secret", 11, "test-user", "Test User")
	if err != nil {
		t.Fatal(err)
	}

	ref := "s3://testbucket/chatnet/chat/11/2026/11/0123456789abcdef0123456789abcdef.jpg"
	token := s.mediaRelayToken(11, ref, 5, "image/jpeg", time.Now().Add(5*time.Minute))
	mux := http.NewServeMux()
	mux.Handle("PUT /api/media/relay", authx.Middleware("relay-test-secret", http.HandlerFunc(s.relayMediaUpload)))
	upload := func(ref, token, mime, body string, want int) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPut, "/api/media/relay?ref="+url.QueryEscape(ref), strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("X-ChatNet-Relay-Token", token)
		req.Header.Set("Content-Type", mime)
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("relay: got %d, want %d: %s", res.Code, want, res.Body.String())
		}
	}
	upload(ref, token, "image/jpeg", "abcde", http.StatusNoContent)
	if storedPath != "/testbucket/chatnet/chat/11/2026/11/0123456789abcdef0123456789abcdef.jpg" ||
		storedBody != "abcde" || storedType != "image/jpeg" {
		t.Fatalf("incorrect S3 PUT, path %q body %q mime %q", storedPath, storedBody, storedType)
	}

	upload(ref, token, "image/png", "abcde", http.StatusForbidden)
	upload(ref, token, "image/jpeg", "shorter", http.StatusForbidden)
	upload("s3://testbucket/chatnet/chat/22/2026/11/0123456789abcdef0123456789abcdef.jpg",
		token, "image/jpeg", "abcde", http.StatusForbidden)
	upload(ref, "1.deadbeef", "image/jpeg", "abcde", http.StatusForbidden)
	expired := s.mediaRelayToken(11, ref, 5, "image/jpeg", time.Now().Add(-time.Minute))
	upload(ref, expired, "image/jpeg", "abcde", http.StatusForbidden)
}
