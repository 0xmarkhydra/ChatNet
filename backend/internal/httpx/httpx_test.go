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
