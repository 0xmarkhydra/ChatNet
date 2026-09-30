package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestLanguageName(t *testing.T) {
	if got := languageName("vi"); got != "Vietnamese" {
		t.Fatalf("languageName(vi)=%q", got)
	}
	if got := languageName("ja"); got != "Japanese" {
		t.Fatalf("languageName(ja)=%q", got)
	}
}

func TestCacheKeyChangesWithTarget(t *testing.T) {
	s := &server{model: "test-model", provider: "partner", apiStyle: "auto"}
	a := s.cacheKey("hello", "vi")
	b := s.cacheKey("hello", "ja")
	if a == b {
		t.Fatal("cache key must include target language")
	}
}

func TestAutoFallsBackToChatCompletions(t *testing.T) {
	responsesCalls := 0
	chatCalls := 0

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/responses":
			responsesCalls++
			http.Error(w, "not found", http.StatusNotFound)
		case "/chat/completions":
			chatCalls++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Xin chào"}}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	s := &server{
		apiKey:     "test-key",
		baseURL:    upstream.URL,
		model:      "partner-model",
		apiStyle:   "auto",
		provider:   "partner",
		authHeader: "Authorization",
		authScheme: "Bearer",
		client:     &http.Client{Timeout: 2 * time.Second},
	}

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	value, style, err := s.callAI(req, "Hello", "vi")
	if err != nil {
		t.Fatal(err)
	}
	if value != "Xin chào" {
		t.Fatalf("translation=%q", value)
	}
	if style != "chat_completions" {
		t.Fatalf("style=%q", style)
	}
	if responsesCalls != 1 || chatCalls != 1 {
		t.Fatalf("calls responses=%d chat=%d", responsesCalls, chatCalls)
	}
}

func TestCustomAuthHeaderWithoutScheme(t *testing.T) {
	var got string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("x-api-key")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer upstream.Close()

	s := &server{
		apiKey:     "secret-value",
		baseURL:    upstream.URL,
		model:      "model",
		authHeader: "x-api-key",
		authScheme: "",
		client:     &http.Client{Timeout: 2 * time.Second},
	}

	_, err := s.callChatCompletions(context.Background(), "translate", "hello")
	if err != nil {
		t.Fatal(err)
	}
	if got != "secret-value" {
		t.Fatalf("x-api-key header=%q", got)
	}
}
