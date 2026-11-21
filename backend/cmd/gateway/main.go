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
	"sync"
	"time"

	"chatnet/internal/config"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
)

func main() {
	authURL := config.Env("AUTH_URL", "http://localhost:8081")
	chatURL := config.Env("CHAT_URL", "http://localhost:8082")
	feedURL := config.Env("FEED_URL", "http://localhost:8083")
	translateURL := config.Env("TRANSLATE_URL", "http://localhost:8084")
	callURL := config.Env("CALL_URL", "http://localhost:8085")

	authProxy := mustProxy(authURL)
	chatProxy := mustProxy(chatURL)
	feedProxy := mustProxy(feedURL)
	translateProxy := mustProxy(translateURL)
	callProxy := mustProxy(callURL)

	healthClient := &http.Client{Timeout: 1200 * time.Millisecond}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/live", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "backend"})
	})
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		components := checkComponents(healthClient, map[string]string{
			"auth":      authURL + "/health",
			"chat":      chatURL + "/health",
			"feed":      feedURL + "/health",
			"translate": translateURL + "/health",
			"call":      callURL + "/health",
		})
		status := "ok"
		code := http.StatusOK
		for _, ok := range components {
			if !ok {
				status = "degraded"
				code = http.StatusServiceUnavailable
				break
			}
		}
		writeJSON(w, code, map[string]any{"status": status, "service": "backend", "components": components})
	})
	readiness := func(w http.ResponseWriter, _ *http.Request) {
		components := checkComponents(healthClient, map[string]string{
			"auth":      authURL + "/ready",
			"chat":      chatURL + "/ready",
			"feed":      feedURL + "/ready",
			"translate": translateURL + "/ready",
			"call":      callURL + "/ready",
		})
		status := "ok"
		code := http.StatusOK
		for _, ok := range components {
			if !ok {
				status = "not_ready"
				code = http.StatusServiceUnavailable
				break
			}
		}
		writeJSON(w, code, map[string]any{"status": status, "service": "backend", "components": components})
	}
	mux.HandleFunc("GET /api/ready", readiness)
	mux.Handle("GET /__chatnet_copy_image", mediax.ClipboardImageHandler(nil))
	mux.Handle("/api/auth/", authProxy)
	mux.Handle("GET /api/link-preview", chatProxy)
	mux.Handle("/api/messages", chatProxy)
	mux.Handle("/api/messages/", chatProxy)
	mux.Handle("/api/events", chatProxy)
	mux.Handle("/api/push/", chatProxy)
	mux.Handle("/api/media/", chatProxy)
	mux.Handle("/api/profile", chatProxy)
	mux.Handle("/api/profile/", chatProxy)
	mux.Handle("/api/users/", chatProxy)
	mux.Handle("/api/users/search", chatProxy)
	mux.Handle("/api/users/suggestions", chatProxy)
	mux.Handle("/api/users/nearby", chatProxy)
	mux.Handle("/api/friends", chatProxy)
	mux.Handle("/api/friends/", chatProxy)
	mux.Handle("/api/contacts", chatProxy)
	mux.Handle("/api/contacts/", chatProxy)
	mux.Handle("/api/privacy", chatProxy)
	mux.Handle("/api/preferences", chatProxy)
	mux.Handle("/api/preferences/", chatProxy)
	mux.Handle("/api/conversation-categories", chatProxy)
	mux.Handle("/api/conversation-categories/", chatProxy)
	mux.Handle("/api/conversations", chatProxy)
	mux.Handle("/api/conversations/", chatProxy)
	mux.Handle("/api/group-invites/", chatProxy)
	mux.Handle("/api/groups/", chatProxy)
	mux.Handle("/api/chat/", chatProxy)
	mux.Handle("/api/calls", callProxy)
	mux.Handle("/api/calls/", callProxy)
	mux.Handle("/api/translate", translateProxy)
	mux.Handle("/api/i18n/", translateProxy)
	mux.Handle("/api/posts", feedProxy)
	mux.Handle("/api/posts/", feedProxy)
	mux.Handle("/api/feed/", feedProxy)
	mux.Handle("/api/stories", feedProxy)
	mux.Handle("/api/stories/", feedProxy)
	mux.Handle("/api/marketplace/", feedProxy)

	if staticDir := strings.TrimSpace(os.Getenv("STATIC_DIR")); staticDir != "" {
		mux.Handle("/", spaHandler(staticDir))
	}

	port := config.Env("PORT", "8080")
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           cors(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		// Keep WriteTimeout disabled: gateway proxies long-lived SSE and WebSocket streams.
		IdleTimeout:       60 * time.Second,
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

func checkComponents(client *http.Client, endpoints map[string]string) map[string]bool {
	type result struct {
		name string
		ok   bool
	}
	results := make(chan result, len(endpoints))
	var wait sync.WaitGroup
	wait.Add(len(endpoints))
	for name, endpoint := range endpoints {
		go func() {
			defer wait.Done()
			results <- result{name: name, ok: healthy(client, endpoint)}
		}()
	}
	wait.Wait()
	close(results)
	components := make(map[string]bool, len(endpoints))
	for item := range results {
		components[item.name] = item.ok
	}
	return components
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
	return httpx.CORS(next)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
