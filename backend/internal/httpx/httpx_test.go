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
			request.Header.Set("Origin", "https://chat.example.com")
			request.Header.Set("Access-Control-Request-Method", method)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if called || response.Code != http.StatusNoContent {
				t.Fatalf("preflight reached handler or failed: called=%v status=%d", called, response.Code)
			}
			if !strings.Contains(response.Header().Get("Access-Control-Allow-Methods"), method) {
				t.Fatalf("missing allowed method %s", method)
			}
		})
	}
}
