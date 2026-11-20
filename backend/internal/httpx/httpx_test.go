package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

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
			if got := response.Header().Get("Vary"); got != "Origin" {
				t.Fatalf("unexpected Vary header %q", got)
			}
		})
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
