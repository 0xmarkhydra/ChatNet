package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/httpx"
)

// Each token is valid for exactly one Gemini Live translation stream.
// Neither the long-lived API key nor the participants' media keys leave the server.
const geminiTranslationModel = "gemini-3.5-live-translate-preview"

var supportedGeminiLiveLanguages = map[string]string{
	"af": "af", "ak": "ak", "sq": "sq", "am": "am", "ar": "ar", "hy": "hy", "az": "az", "eu": "eu", "be": "be", "bn": "bn", "bg": "bg", "my": "my", "ca": "ca",
	"zh": "zh-Hans", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant", "hr": "hr", "cs": "cs", "da": "da", "nl": "nl", "en": "en", "et": "et", "fil": "fil", "tl": "fil",
	"fi": "fi", "fr": "fr", "gl": "gl", "ka": "ka", "de": "de", "el": "el", "gu": "gu", "ha": "ha", "he": "he", "hi": "hi", "hu": "hu", "is": "is", "id": "id",
	"it": "it", "ja": "ja", "jv": "jv", "kn": "kn", "kk": "kk", "km": "km", "rw": "rw", "ko": "ko", "lo": "lo", "lv": "lv", "lt": "lt", "mk": "mk", "ms": "ms",
	"ml": "ml", "mr": "mr", "mn": "mn", "ne": "ne", "no": "no", "nb": "nb", "fa": "fa", "pl": "pl", "pt": "pt-BR", "pt-br": "pt-BR", "pt-pt": "pt-PT",
	"pa": "pa", "ro": "ro", "ru": "ru", "sr": "sr", "sd": "sd", "si": "si", "sk": "sk", "sl": "sl", "es": "es", "su": "su", "sw": "sw", "sv": "sv",
	"ta": "ta", "te": "te", "th": "th", "tr": "tr", "uk": "uk", "ur": "ur", "uz": "uz", "vi": "vi", "zu": "zu",
}

func (s *server) callTranslationToken(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}
	callID := strings.TrimSpace(r.PathValue("id"))
	call, _, err := s.authorizedCall(r.Context(), callID, claims.UserID)
	if err != nil || (call.Status != "ringing" && call.Status != "active") {
		httpx.Error(w, http.StatusForbidden, "not an active call member")
		return
	}
	var joined bool
	err = s.db.QueryRow(r.Context(), `SELECT EXISTS (
  SELECT 1 FROM call_participants WHERE call_id=$1 AND user_id=$2
  AND joined_at IS NOT NULL AND left_at IS NULL AND declined_at IS NULL
 )`, callID, claims.UserID).Scan(&joined)
	if err != nil || !joined {
		httpx.Error(w, http.StatusForbidden, "join the call before enabling translation")
		return
	}
	if !s.allow(w, r, "call-gemini-token", claims.UserID, 20, time.Minute) {
		return
	}
	var body struct {
		TargetLanguage string `json:"targetLanguage"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid translation request")
		return
	}
	target, supported := supportedGeminiLiveLanguages[strings.ToLower(strings.TrimSpace(body.TargetLanguage))]
	if !supported {
		httpx.Error(w, http.StatusBadRequest, "unsupported target language")
		return
	}
	apiKey := strings.TrimSpace(config.Env("GEMINI_API_KEY", ""))
	if apiKey == "" {
		httpx.Error(w, http.StatusServiceUnavailable, "Gemini Live translation is not configured")
		return
	}
	payload := geminiTokenPayload(target, time.Now().UTC())
	raw, err := json.Marshal(payload)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "invalid Gemini configuration")
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://generativelanguage.googleapis.com/v1beta/auth_tokens", bytes.NewReader(raw))
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "Gemini connection unavailable")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Gemini token request failed: %v", err)
		httpx.Error(w, http.StatusBadGateway, "Gemini connection unavailable")
		return
	}
	defer resp.Body.Close()
	reply, err := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		googleCode, googleReason := geminiTokenError(reply)
		log.Printf("Gemini token issue http_status=%d provider_status=%s provider_reason=%q read_error=%v", resp.StatusCode, googleCode, googleReason, err)
		httpx.Error(w, http.StatusBadGateway, "Gemini Live translation unavailable")
		return
	}
	var issued struct {
		Name string `json:"name"`
	}
	if json.Unmarshal(reply, &issued) != nil || issued.Name == "" {
		httpx.Error(w, http.StatusBadGateway, "invalid Gemini token response")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]string{
		"token":          issued.Name,
		"model":          geminiTranslationModel,
		"targetLanguage": target,
	})
}

var geminiSensitiveTokenPattern = regexp.MustCompile(`(?i)(?:AIza[0-9a-z_-]{15,}|AQ[.][0-9a-z_.-]{15,}|auth_tokens/[0-9a-z_-]{12,})`)

// Return only a sanitized provider diagnostic. Never log the request's API key or an issued token.
func geminiTokenError(raw []byte) (status, reason string) {
	var reply struct {
		Error struct {
			Status  string `json:"status"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(raw, &reply) != nil {
		return "unparseable", "provider response could not be parsed"
	}
	status = strings.TrimSpace(reply.Error.Status)
	if status == "" {
		status = "unknown"
	}
	reason = strings.Join(strings.Fields(reply.Error.Message), " ")
	reason = geminiSensitiveTokenPattern.ReplaceAllString(reason, "[redacted]")
	if len(reason) > 360 {
		reason = reason[:360]
	}
	if reason == "" {
		reason = "no provider message"
	}
	return
}

// Request body is shared by the live endpoint and one-time startup diagnostic.
func geminiTokenPayload(target string, now time.Time) map[string]any {
	return map[string]any{
		"uses":                 1,
		"newSessionExpireTime": now.Add(time.Minute).Format(time.RFC3339),
		"expireTime":           now.Add(30 * time.Minute).Format(time.RFC3339),
		"liveConnectConstraints": map[string]any{
			"model": "models/" + geminiTranslationModel,
			"config": map[string]any{
				"responseModalities":       []string{"AUDIO"},
				"inputAudioTranscription":  map[string]any{},
				"outputAudioTranscription": map[string]any{},
				"translationConfig": map[string]any{
					"targetLanguageCode": target,
					"echoTargetLanguage": false,
				},
			},
		},
	}
}

func diagnoseGeminiLiveOnBoot() {
	apiKey := strings.TrimSpace(config.Env("GEMINI_API_KEY", ""))
	if apiKey == "" {
		log.Print("Gemini Live diagnostic: GEMINI_API_KEY missing on backend service")
		return
	}
	// Startup check never exposes the key or generated session token and sends no audio.
	payload, _ := json.Marshal(geminiTokenPayload("en", time.Now().UTC()))
	req, err := http.NewRequest(http.MethodPost, "https://generativelanguage.googleapis.com/v1beta/auth_tokens", bytes.NewReader(payload))
	if err != nil {
		log.Printf("Gemini Live diagnostic: malformed request: %v", err)
		return
	}
	req.Header.Set("x-goog-api-key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Gemini Live diagnostic: network error: %v", err)
		return
	}
	defer resp.Body.Close()
	reply, err := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
	if err != nil {
		log.Printf("Gemini Live diagnostic: response error: %v", err)
		return
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		providerCode, providerReason := geminiTokenError(reply)
		log.Printf("Gemini Live diagnostic: http_status=%d provider_status=%s provider_reason=%q", resp.StatusCode, providerCode, providerReason)
		return
	}
	log.Printf("Gemini Live diagnostic: token provisioning succeeded")
}
