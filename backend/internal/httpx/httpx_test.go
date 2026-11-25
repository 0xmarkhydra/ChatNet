package httpx

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONRejectsUnknownTrailingAndOversizedBodies(t *testing.T) {
	for _, tc := range []struct {
		name string
		body string
		max  int64
		want bool
	}{
		{name: "valid", body: `{"value":"ok"}`, max: 64, want: true},
		{name: "unknown field", body: `{"value":"ok","extra":true}`, max: 64},
		{name: "trailing value", body: `{"value":"ok"}{}`, max: 64},
		{name: "oversized", body: `{"value":"ok"}`, max: 8},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(tc.body))
			w := httptest.NewRecorder()
			var dst struct {
				Value string `json:"value"`
			}
			got := DecodeJSON(w, r, &dst, tc.max) == nil
			if got != tc.want {
				t.Fatalf("DecodeJSON success=%v, want %v", got, tc.want)
			}
		})
	}
}

func TestCORSPreflight(t *testing.T) {
	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			called := false
			handler := CORS(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
				called = true
			}))
			request := httptest.NewRequest(http.MethodOptions, "/api/push/subscription", nil)
			request.Header.Set("Origin", "https://chat.codelocal.cloud")
			request.Header.Set("Access-Control-Request-Method", method)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if called || response.Code != http.StatusNoContent {
				t.Fatalf("preflight reached handler or failed: called=%v status=%d", called, response.Code)
			}
			if !strings.Contains(response.Header().Get("Access-Control-Allow-Methods"), method) {
				t.Fatalf("missing allowed method %s", method)
			}
			if got := response.Header().Get("Access-Control-Allow-Origin"); got != "https://chat.codelocal.cloud" {
				t.Fatalf("unexpected allowed origin %q", got)
			}
			if got := response.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
				t.Fatalf("unexpected credential policy %q", got)
			}
			if got := response.Header().Get("Vary"); got != "Origin" {
				t.Fatalf("unexpected Vary header %q", got)
			}
		})
	}
}

func TestIsWebOriginUsesExactConfiguredOrigin(t *testing.T) {
	t.Setenv("CHATNET_WEB_URL", "https://web.example")
	t.Setenv("CHATNET_CORS_ORIGINS", "https://web.example")
	if !IsWebOrigin("https://web.example") || IsWebOrigin("https://web.example.evil") || IsWebOrigin("https://other.example") {
		t.Fatal("web origin check must match exact configured origin")
	}
	t.Setenv("CHATNET_CORS_ORIGINS", "https://other.example")
	if IsWebOrigin("https://web.example") {
		t.Fatal("web origin must be present in the CORS allowlist")
	}
}

func TestCORSRejectsUntrustedOrigin(t *testing.T) {
	called := false
	handler := CORS(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
	}))
	request := httptest.NewRequest(http.MethodOptions, "/api/health", nil)
	request.Header.Set("Origin", "https://evil.example")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if called || response.Code != http.StatusNoContent {
		t.Fatalf("preflight reached handler or failed: called=%v status=%d", called, response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("untrusted origin allowed: %q", got)
	}
	if got := response.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("unexpected Vary header %q", got)
	}
}

func TestCORSUsesConfiguredOrigins(t *testing.T) {
	t.Setenv("CHATNET_CORS_ORIGINS", "https://configured.example")
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))

	for _, test := range []struct {
		origin string
		allow  string
	}{
		{origin: "https://configured.example", allow: "https://configured.example"},
		{origin: "https://chat.codelocal.cloud", allow: ""},
	} {
		request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
		request.Header.Set("Origin", test.origin)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if got := response.Header().Get("Access-Control-Allow-Origin"); got != test.allow {
			t.Fatalf("origin %q: got allow origin %q, want %q", test.origin, got, test.allow)
		}
	}
}

func TestCORSAllowsRequiredDefaultOrigins(t *testing.T) {
	for _, origin := range []string{
		"https://chat.codelocal.cloud",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"app://soco",
	} {
		handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusAccepted)
		}))
		request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
		request.Header.Set("Origin", origin)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if got := response.Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Fatalf("origin %q: got allow origin %q", origin, got)
		}
	}
}
