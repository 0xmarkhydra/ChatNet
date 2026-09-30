package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"chatnet/internal/config"
)

func main() {
	authURL := config.Env("AUTH_URL", "http://localhost:8081")
	chatURL := config.Env("CHAT_URL", "http://localhost:8082")
	feedURL := config.Env("FEED_URL", "http://localhost:8083")
	translateURL := config.Env("TRANSLATE_URL", "http://localhost:8084")

	authProxy := mustProxy(authURL)
	chatProxy := mustProxy(chatURL)
	feedProxy := mustProxy(feedURL)
	translateProxy := mustProxy(translateURL)

	healthClient := &http.Client{Timeout: 1200 * time.Millisecond}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		components := map[string]bool{
			"auth":      healthy(healthClient, authURL+"/health"),
			"chat":      healthy(healthClient, chatURL+"/health"),
			"feed":      healthy(healthClient, feedURL+"/health"),
			"translate": healthy(healthClient, translateURL+"/health"),
		}
		status := "ok"
		code := http.StatusOK
		for _, ok := range components {
			if !ok {
				status = "degraded"
				code = http.StatusServiceUnavailable
				break
			}
		}
		writeJSON(w, code, map[string]any{
			"status":     status,
			"service":    "backend",
			"components": components,
		})
	})
	mux.Handle("/api/auth/", authProxy)
	mux.Handle("/api/messages", chatProxy)
	mux.Handle("/api/events", chatProxy)
	mux.Handle("/api/push/", chatProxy)
	mux.Handle("/api/media/", chatProxy)
	mux.Handle("/api/users/search", chatProxy)
	mux.Handle("/api/users/suggestions", chatProxy)
	mux.Handle("/api/preferences/", chatProxy)
	mux.Handle("/api/conversations", chatProxy)
	mux.Handle("/api/conversations/", chatProxy)
	mux.Handle("/api/translate", translateProxy)
	mux.Handle("/api/posts", feedProxy)
	mux.Handle("/api/posts/", feedProxy)

	if staticDir := strings.TrimSpace(os.Getenv("STATIC_DIR")); staticDir != "" {
		mux.Handle("/", spaHandler(staticDir))
	}

	port := config.Env("PORT", "8080")
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           cors(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("gateway listening on :%s", port)
	log.Fatal(server.ListenAndServe())
}

func healthy(client *http.Client, endpoint string) bool {
	resp, err := client.Get(endpoint)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func mustProxy(rawURL string) *httputil.ReverseProxy {
	target, err := url.Parse(rawURL)
	if err != nil {
		log.Fatalf("invalid upstream %s: %v", rawURL, err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		log.Printf("upstream error: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "service unavailable"})
	}
	return proxy
}

func spaHandler(staticDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(staticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requested := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
		candidate := filepath.Join(staticDir, requested)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
