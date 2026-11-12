package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
)

// Relay tokens bind the user, exact object, byte count, content type and
// expiration. The API never accepts an arbitrary caller-selected S3 URL.
func (s *server) mediaRelayToken(userID int64, ref string, bytes int64, contentType string, expiry time.Time) string {
	unix := expiry.Unix()
	payload := fmt.Sprintf("%d\n%s\n%d\n%s\n%d", userID, ref, bytes, contentType, unix)
	mac := hmac.New(sha256.New, []byte("chatnet-media-relay-v1:"+s.jwtSecret))
	_, _ = mac.Write([]byte(payload))
	return strconv.FormatInt(unix, 10) + "." + hex.EncodeToString(mac.Sum(nil))
}

func (s *server) validMediaRelayToken(userID int64, ref string, bytes int64, contentType, token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || len(parts[1]) != sha256.Size*2 {
		return false
	}
	expiry, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || expiry <= time.Now().Unix() || expiry > time.Now().Add(11*time.Minute).Unix() {
		return false
	}
	signature, err := hex.DecodeString(parts[1])
	if err != nil {
		return false
	}
	expected := strings.Split(s.mediaRelayToken(userID, ref, bytes, contentType, time.Unix(expiry, 0)), ".")
	expectedSignature, _ := hex.DecodeString(expected[1])
	return hmac.Equal(signature, expectedSignature)
}

func (s *server) relayMediaUpload(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	if s.storage == nil || !s.storage.Configured() {
		httpx.Error(w, http.StatusServiceUnavailable, "kho file S3 chưa được cấu hình")
		return
	}
	ref := strings.TrimSpace(r.URL.Query().Get("ref"))
	contentType := strings.TrimSpace(r.Header.Get("Content-Type"))
	bytes := r.ContentLength
	if bytes <= 0 || bytes > mediax.MaxVideoBytes || contentType == "" {
		httpx.Error(w, http.StatusBadRequest, "kích thước hoặc loại file upload không hợp lệ")
		return
	}
	owned := false
	for _, scope := range []string{"chat", "feed", "story", "profile"} {
		if s.storage.Owns(ref, scope, claims.UserID) {
			owned = true
			break
		}
	}
	if !owned || !s.validMediaRelayToken(claims.UserID, ref, bytes, contentType, r.Header.Get("X-ChatNet-Relay-Token")) {
		httpx.Error(w, http.StatusForbidden, "quyền upload không hợp lệ hoặc đã hết hạn")
		return
	}
	// Never buffer uploaded media in application memory.
	r.Body = http.MaxBytesReader(w, r.Body, bytes)
	if err := s.storage.Put(r.Context(), ref, contentType, bytes, r.Body); err != nil {
		log.Printf("S3 relay upload failed: %v", err)
		httpx.Error(w, http.StatusBadGateway, "không thể chuyển file tới kho S3")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}
