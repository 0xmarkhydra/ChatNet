package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"chatnet/internal/config"
)

var defaultCORSOrigins = []string{
	"https://chat.codelocal.cloud",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"app://soco",
}

// DecodeJSON bounds request bodies and accepts exactly one JSON value.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any, maxBytes int64) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return errors.New("unexpected trailing JSON")
		}
		return err
	}
	return nil
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"error": message})
}

func CORS(next http.Handler) http.Handler {
	allowedOrigins := corsOrigins()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		if origin := strings.TrimSpace(r.Header.Get("Origin")); origin != "" {
			if _, ok := allowedOrigins[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-ChatNet-Relay-Token")
				w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func corsOrigins() map[string]struct{} {
	raw := config.Env("CHATNET_CORS_ORIGINS", "")
	if raw == "" {
		raw = config.Env("CORS_ALLOWED_ORIGINS", "")
	}
	if raw == "" {
		origins := append([]string(nil), defaultCORSOrigins...)
		origins[0] = strings.TrimRight(config.Env("CHATNET_WEB_URL", origins[0]), "/")
		raw = strings.Join(origins, ",")
	}

	allowed := make(map[string]struct{})
	for _, value := range strings.Split(raw, ",") {
		origin := strings.TrimRight(strings.TrimSpace(value), "/")
		if origin != "" {
			allowed[origin] = struct{}{}
		}
	}
	return allowed
}
