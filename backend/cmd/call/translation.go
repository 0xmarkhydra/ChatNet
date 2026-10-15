package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/httpx"
	"github.com/gorilla/websocket"
)

const (
	geminiTranslationModel  = "gemini-3.5-live-translate-preview"
	geminiLiveURL           = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
	translationTicketTTL    = 40 * time.Second
	translationSessionLimit = 5
	translationMaxPCM       = 8192 // 250 ms max @ 16 kHz mono PCM16
)

var supportedGeminiLiveLanguages = map[string]string{
	"af": "af", "ak": "ak", "sq": "sq", "am": "am", "ar": "ar", "hy": "hy", "az": "az", "eu": "eu", "be": "be", "bn": "bn", "bg": "bg", "my": "my", "ca": "ca",
	"zh": "zh-Hans", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant", "hr": "hr", "cs": "cs", "da": "da", "nl": "nl", "en": "en", "et": "et", "fil": "fil", "tl": "fil",
	"fi": "fi", "fr": "fr", "gl": "gl", "ka": "ka", "de": "de", "el": "el", "gu": "gu", "ha": "ha", "he": "he", "hi": "hi", "hu": "hu", "is": "is", "id": "id",
	"it": "it", "ja": "ja", "jv": "jv", "kn": "kn", "kk": "kk", "km": "km", "rw": "rw", "ko": "ko", "lo": "lo", "lv": "lv", "lt": "lt", "mk": "mk", "ms": "ms",
	"ml": "ml", "mr": "mr", "mn": "mn", "ne": "ne", "no": "no", "nb": "nb", "fa": "fa", "pl": "pl", "pt": "pt-BR", "pt-br": "pt-BR", "pt-pt": "pt-PT",
	"pa": "pa", "ro": "ro", "ru": "ru", "sr": "sr", "sd": "sd", "si": "si", "sk": "sk", "sl": "sl", "es": "es", "su": "su", "sw": "sw", "sv": "sv",
	"ta": "ta", "te": "te", "th": "th", "tr": "tr", "uk": "uk", "ur": "ur", "uz": "uz", "vi": "vi", "zu": "zu",
}

// A one-time ticket is scoped to a call, listening member, speaker and target locale.
// Browser code never receives Gemini credentials, endpoint details, or model configuration.
type translationTicket struct {
	CallID    string `json:"callId"`
	UserID    int64  `json:"userId"`
	SpeakerID int64  `json:"speakerId"`
	Target    string `json:"target"`
}

func translationTicketKey(ticket string) string {
	hash := sha256.Sum256([]byte(ticket))
	return "chatnet:call:translation:ticket:" + hex.EncodeToString(hash[:])
}

func (s *server) callTranslationLanguages(w http.ResponseWriter, r *http.Request) {
	seen := map[string]bool{}
	codes := make([]string, 0, len(supportedGeminiLiveLanguages))
	for _, code := range supportedGeminiLiveLanguages {
		if !seen[code] {
			seen[code] = true
			codes = append(codes, code)
		}
	}
	// Client sorts by its own locale, so API language order is non-semantic.
	httpx.JSON(w, http.StatusOK, map[string]any{"languages": codes})
}

func (s *server) verifyLiveCallParticipant(r *http.Request, callID string, userID int64) error {
	call, _, err := s.authorizedCall(r.Context(), callID, userID)
	if err != nil || (call.Status != "ringing" && call.Status != "active") {
		return errors.New("not an active call member")
	}
	var joined bool
	err = s.db.QueryRow(r.Context(), `SELECT EXISTS (
 SELECT 1 FROM call_participants WHERE call_id=$1 AND user_id=$2
 AND joined_at IS NOT NULL AND left_at IS NULL AND declined_at IS NULL
 )`, callID, userID).Scan(&joined)
	if err != nil || !joined {
		return errors.New("member has not joined the call")
	}
	return nil
}

func (s *server) createCallTranslationSession(w http.ResponseWriter, r *http.Request) {
	claims, ok := authx.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, 401, "unauthorized")
		return
	}
	callID := strings.TrimSpace(r.PathValue("id"))
	if err := s.verifyLiveCallParticipant(r, callID, claims.UserID); err != nil {
		httpx.Error(w, 403, err.Error())
		return
	}
	if !s.allow(w, r, "call-translation-ticket", claims.UserID, 25, time.Minute) {
		return
	}
	if strings.TrimSpace(config.Env("GEMINI_API_KEY", "")) == "" {
		httpx.Error(w, 503, "Live translation has not been configured")
		return
	}
	var body struct {
		TargetLanguage string `json:"targetLanguage"`
		SpeakerID      string `json:"speakerId"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil {
		httpx.Error(w, 400, "invalid request")
		return
	}
	target, ok := supportedGeminiLiveLanguages[strings.ToLower(strings.TrimSpace(body.TargetLanguage))]
	if !ok {
		httpx.Error(w, 400, "unsupported language")
		return
	}
	var speakerID int64
	if _, err := fmt.Sscanf(body.SpeakerID, "u_%d", &speakerID); err != nil || speakerID <= 0 || speakerID == claims.UserID {
		httpx.Error(w, 400, "invalid remote speaker")
		return
	}
	if err := s.verifyLiveCallParticipant(r, callID, speakerID); err != nil {
		httpx.Error(w, 403, "speaker is not a joined call member")
		return
	}
	ticket, err := secureID("cnlt_", 24)
	if err != nil {
		httpx.Error(w, 500, "cannot create translation session")
		return
	}
	raw, _ := json.Marshal(translationTicket{CallID: callID, UserID: claims.UserID, SpeakerID: speakerID, Target: target})
	if err := s.redis.Set(r.Context(), translationTicketKey(ticket), raw, translationTicketTTL).Err(); err != nil {
		httpx.Error(w, 503, "translation sessions unavailable")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, 200, map[string]string{"ticket": ticket})
}

func translationAllowedOrigin(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return false
	}
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return false
	}
	allowed := strings.TrimSpace(config.Env("CHATNET_WEB_URL", "https://chat.codelocal.cloud"))
	target, err := url.Parse(allowed)
	if err == nil && strings.EqualFold(parsed.Host, target.Host) && parsed.Scheme == target.Scheme {
		return true
	}
	// Local development only.
	return (parsed.Host == "localhost:5173" || parsed.Host == "127.0.0.1:5173") && parsed.Scheme == "http"
}

var translationUpgrader = websocket.Upgrader{
	HandshakeTimeout: 8 * time.Second,
	ReadBufferSize:   8192,
	WriteBufferSize:  8192,
	CheckOrigin:      translationAllowedOrigin,
}

func (s *server) streamCallTranslation(w http.ResponseWriter, r *http.Request) {
	rawTicket := strings.TrimSpace(r.URL.Query().Get("ticket"))
	if len(rawTicket) < 20 || len(rawTicket) > 120 {
		http.Error(w, "invalid ticket", 401)
		return
	}
	stored, err := s.redis.GetDel(r.Context(), translationTicketKey(rawTicket)).Bytes()
	if err != nil {
		http.Error(w, "expired or used ticket", 401)
		return
	}
	var ticket translationTicket
	if json.Unmarshal(stored, &ticket) != nil || ticket.CallID != r.PathValue("id") || ticket.UserID <= 0 ||
		ticket.SpeakerID <= 0 || supportedGeminiLiveLanguages[strings.ToLower(ticket.Target)] != ticket.Target {
		http.Error(w, "invalid ticket scope", 401)
		return
	}
	if err := s.verifyLiveCallParticipant(r, ticket.CallID, ticket.UserID); err != nil {
		http.Error(w, "not an active call member", 403)
		return
	}
	if err := s.verifyLiveCallParticipant(r, ticket.CallID, ticket.SpeakerID); err != nil {
		http.Error(w, "speaker unavailable", 403)
		return
	}
	if !translationAllowedOrigin(r) {
		http.Error(w, "invalid origin", 403)
		return
	}

	quotaKey := fmt.Sprintf("chatnet:call:translation:active:%s:%d", ticket.CallID, ticket.UserID)
	active, err := s.redis.Incr(r.Context(), quotaKey).Result()
	if err != nil {
		http.Error(w, "translation capacity unavailable", 503)
		return
	}
	s.redis.Expire(r.Context(), quotaKey, 45*time.Minute)
	defer s.redis.Decr(context.Background(), quotaKey)
	if active > translationSessionLimit {
		http.Error(w, "too many translation streams", 429)
		return
	}

	client, err := translationUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Minute)
	defer cancel()
	google, err := connectGeminiLive(ctx, ticket.Target)
	if err != nil {
		log.Printf("live translation connect failed: %s", safeTranslationError(err))
		_ = client.WriteJSON(map[string]string{"type": "error", "message": "Không kết nối được dịch trực tiếp. Kiểm tra quyền truy cập Gemini và thử lại."})
		return
	}
	defer google.Close()

	var writeMu sync.Mutex
	send := func(data any) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = client.SetWriteDeadline(time.Now().Add(5 * time.Second))
		return client.WriteJSON(data)
	}
	_ = send(map[string]string{"type": "ready"})
	log.Printf("live translation session ready call=%s listener=%d speaker=%d", ticket.CallID, ticket.UserID, ticket.SpeakerID)

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, data, err := google.ReadMessage()
			if err != nil {
				if ctx.Err() == nil {
					log.Printf("Gemini Live ended call=%s: %s", ticket.CallID, safeTranslationError(err))
					_ = send(map[string]string{"type": "error", "message": "Phiên dịch bị ngắt. Hãy bật Dịch AI lại."})
				}
				return
			}
			var event struct {
				ServerContent struct {
					InputTranscription struct {
						Text string `json:"text"`
					} `json:"inputTranscription"`
					OutputTranscription struct {
						Text string `json:"text"`
					} `json:"outputTranscription"`
					ModelTurn struct {
						Parts []struct {
							InlineData struct {
								MimeType string `json:"mimeType"`
								Data     string `json:"data"`
							} `json:"inlineData"`
						} `json:"parts"`
					} `json:"modelTurn"`
				} `json:"serverContent"`
			}
			if json.Unmarshal(data, &event) != nil {
				continue
			}
			c := event.ServerContent
			if c.InputTranscription.Text != "" && len(c.InputTranscription.Text) <= 4000 {
				if send(map[string]string{"type": "original", "text": c.InputTranscription.Text}) != nil {
					return
				}
			}
			if c.OutputTranscription.Text != "" && len(c.OutputTranscription.Text) <= 4000 {
				if send(map[string]string{"type": "translated", "text": c.OutputTranscription.Text}) != nil {
					return
				}
			}
			for _, part := range c.ModelTurn.Parts {
				audio := part.InlineData
				if strings.HasPrefix(audio.MimeType, "audio/pcm") && len(audio.Data) <= 256*1024 {
					if send(map[string]string{"type": "audio", "data": audio.Data}) != nil {
						return
					}
				}
			}
		}
	}()
	client.SetReadLimit(translationMaxPCM + 1024)
	for {
		select {
		case <-done:
			return
		case <-ctx.Done():
			return
		default:
		}
		_ = client.SetReadDeadline(time.Now().Add(20 * time.Second))
		kind, frame, err := client.ReadMessage()
		if err != nil {
			return
		}
		if kind != websocket.BinaryMessage || len(frame) == 0 || len(frame) > translationMaxPCM || len(frame)%2 != 0 {
			_ = send(map[string]string{"type": "error", "message": "Định dạng âm thanh không hợp lệ."})
			return
		}
		_ = google.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if err := google.WriteJSON(map[string]any{"realtimeInput": map[string]any{
			"audio": map[string]string{"data": base64.StdEncoding.EncodeToString(frame), "mimeType": "audio/pcm;rate=16000"},
		}}); err != nil {
			log.Printf("live translation write failed: %s", safeTranslationError(err))
			return
		}
	}
}

func geminiLiveSetup(target string) map[string]any {
	return map[string]any{
		"setup": map[string]any{
			"model": "models/" + geminiTranslationModel,
			"generationConfig": map[string]any{
				"responseModalities":       []string{"AUDIO"},
				"inputAudioTranscription":  map[string]any{},
				"outputAudioTranscription": map[string]any{},
				"translationConfig":        map[string]any{"targetLanguageCode": target, "echoTargetLanguage": false},
			},
		},
	}
}

func safeTranslationError(err error) string {
	if err == nil {
		return ""
	}
	var closeErr *websocket.CloseError
	if errors.As(err, &closeErr) {
		return fmt.Sprintf("websocket close code=%d", closeErr.Code)
	}
	return fmt.Sprintf("%T", err) // Avoid URLs and credential-bearing handshake details in logs.
}

func connectGeminiLive(ctx context.Context, target string) (*websocket.Conn, error) {
	apiKey := strings.TrimSpace(config.Env("GEMINI_API_KEY", ""))
	if apiKey == "" {
		return nil, errors.New("Gemini not configured")
	}
	// Never expose this URL or its key to client code, logs, or exception messages.
	endpoint := geminiLiveURL + "?key=" + url.QueryEscape(apiKey)
	dialer := websocket.Dialer{HandshakeTimeout: 12 * time.Second, EnableCompression: false}
	google, resp, err := dialer.DialContext(ctx, endpoint, nil)
	if err != nil {
		if resp != nil {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			resp.Body.Close()
			status, reason := parseGeminiLiveError(body)
			log.Printf("Gemini Live handshake http_status=%d provider_status=%s provider_reason=%q", resp.StatusCode, status, reason)
		}
		return nil, errors.New("Gemini Live websocket rejected connection")
	}
	_ = google.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := google.WriteJSON(geminiLiveSetup(target)); err != nil {
		google.Close()
		return nil, errors.New("Gemini Live setup failed")
	}
	_ = google.SetReadDeadline(time.Now().Add(12 * time.Second))
	_, response, err := google.ReadMessage()
	if err != nil {
		google.Close()
		return nil, err
	}
	var ready struct {
		SetupComplete json.RawMessage `json:"setupComplete"`
		Error         struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(response, &ready) != nil || len(ready.SetupComplete) == 0 {
		google.Close()
		reason := strings.Join(strings.Fields(ready.Error.Message), " ")
		if len(reason) > 200 {
			reason = reason[:200]
		}
		log.Printf("Gemini Live setup refused code=%d reason=%q", ready.Error.Code, reason)
		return nil, errors.New("Gemini Live setup not accepted")
	}
	_ = google.SetReadDeadline(time.Time{})
	return google, nil
}

// One protected startup probe checks model access without voice or exposing credentials.
func diagnoseGeminiLiveOnBoot() {
	if strings.TrimSpace(config.Env("GEMINI_API_KEY", "")) == "" {
		log.Print("Gemini Live diagnostic: GEMINI_API_KEY missing on backend")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 18*time.Second)
	defer cancel()
	session, err := connectGeminiLive(ctx, "en")
	if err != nil {
		log.Printf("Gemini Live diagnostic: connection failed (%s)", safeTranslationError(err))
		return
	}
	_ = session.Close()
	log.Print("Gemini Live diagnostic: model connection and setup succeeded")
}

func parseGeminiLiveError(raw []byte) (string, string) {
	var reply struct {
		Error struct {
			Status  string `json:"status"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(raw, &reply) != nil {
		return "UNKNOWN", "malformed response"
	}
	message := strings.Join(strings.Fields(reply.Error.Message), " ")
	// Diagnostic codes are useful, raw provider text may contain secrets.
	if len(message) > 250 {
		message = message[:250]
	}
	if strings.Contains(strings.ToLower(message), "key") || strings.Contains(message, "AIza") || strings.Contains(message, "AQ.") {
		return reply.Error.Status, "provider rejected credentials or request"
	}
	return reply.Error.Status, message
}
