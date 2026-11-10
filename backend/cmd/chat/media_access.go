package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"chatnet/internal/config"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
)

// This is a per-viewer app capability, NOT a raw S3 URL. Authorization is
// rechecked against PostgreSQL on every GET, including Range requests.
const mediaTicketTTL = time.Hour

func (s *server) mediaTicket(id, viewerID int64) string {
	expiry := time.Now().UTC().Add(mediaTicketTTL).Unix()
	payload := fmt.Sprintf("chat-media:%d:%d:%d", id, viewerID, expiry)
	mac := hmac.New(sha256.New, []byte("media-access-v1:"+s.jwtSecret))
	_, _ = mac.Write([]byte(payload))
	origin := strings.TrimRight(config.Env("MEDIA_PUBLIC_ORIGIN", "https://api-chat.codelocal.cloud"), "/")
	return fmt.Sprintf("%s/api/media/chat/%d?viewer=%d&expires=%d&sig=%s",
		origin, id, viewerID, expiry, hex.EncodeToString(mac.Sum(nil)))
}

func (s *server) verifyMediaTicket(id int64, query url.Values) (int64, bool) {
	one := func(name string) string {
		values := query[name]
		if len(values) != 1 {
			return ""
		}
		return values[0]
	}
	viewer, err := strconv.ParseInt(one("viewer"), 10, 64)
	if err != nil || viewer <= 0 || id <= 0 {
		return 0, false
	}
	expiry, err := strconv.ParseInt(one("expires"), 10, 64)
	now := time.Now().UTC().Unix()
	if err != nil || expiry <= now || expiry > now+int64(mediaTicketTTL.Seconds())+1 {
		return 0, false
	}
	provided, err := hex.DecodeString(one("sig"))
	if err != nil {
		return 0, false
	}
	payload := fmt.Sprintf("chat-media:%d:%d:%d", id, viewer, expiry)
	mac := hmac.New(sha256.New, []byte("media-access-v1:"+s.jwtSecret))
	_, _ = mac.Write([]byte(payload))
	return viewer, hmac.Equal(provided, mac.Sum(nil))
}

// Any denied, removed, recalled or blocked attachment fails closed.
// Direct conversations additionally refuse access if the other peer is blocked.
const mediaAccessSQL = `
 SELECT ma.storage_ref, ma.content_type, ma.original_name, ma.kind
 FROM message_attachments ma
 JOIN messages m ON m.id=ma.message_id AND m.deleted_at IS NULL
 JOIN conversations c ON c.id=m.conversation_id
 JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=$2
 WHERE ma.id=$1
   AND NOT EXISTS (
    SELECT 1 FROM user_blocks b WHERE
      (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR
      (b.blocked_id=$2 AND b.blocker_id=m.user_id)
   )
   AND (c.type<>'direct' OR NOT EXISTS (
    SELECT 1 FROM conversation_members peer
    JOIN user_blocks b ON
      (b.blocker_id=$2 AND b.blocked_id=peer.user_id) OR
      (b.blocked_id=$2 AND b.blocker_id=peer.user_id)
    WHERE peer.conversation_id=c.id AND peer.user_id<>$2
   ))
`

func (s *server) serveChatMedia(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store, max-age=0")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusNotFound, "media not found")
		return
	}
	viewer, valid := s.verifyMediaTicket(id, r.URL.Query())
	if !valid {
		httpx.Error(w, http.StatusForbidden, "media link expired or invalid")
		return
	}
	var storageRef, contentType, name, kind string
	if err = s.db.QueryRow(r.Context(), mediaAccessSQL, id, viewer).Scan(&storageRef, &contentType, &name, &kind); err != nil {
		httpx.Error(w, http.StatusForbidden, "media access revoked or unavailable")
		return
	}
	if s.storage == nil || !s.storage.Configured() {
		httpx.Error(w, http.StatusServiceUnavailable, "media storage unavailable")
		return
	}
	// Limit Range input before making an upstream request. S3 handles byte bounds.
	byteRange := strings.TrimSpace(r.Header.Get("Range"))
	if len(byteRange) > 128 || (byteRange != "" && (!strings.HasPrefix(byteRange, "bytes=") || strings.Contains(byteRange, ","))) {
		httpx.Error(w, http.StatusRequestedRangeNotSatisfiable, "invalid range")
		return
	}
	resp, err := s.storage.Open(r.Context(), storageRef, byteRange)
	if err != nil {
		log.Printf("chat media fetch failed: %v", err)
		httpx.Error(w, http.StatusBadGateway, "media unavailable")
		return
	}
	defer resp.Body.Close()
	if kind == "file" {
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	}
	w.Header().Set("Content-Type", contentType)
	for _, header := range []string{"Content-Length", "Content-Range", "Accept-Ranges", "ETag"} {
		if value := resp.Header.Get(header); value != "" {
			w.Header().Set(header, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil && r.Context().Err() == nil {
		log.Printf("chat media stream interrupted: %v", err)
	}
}

func (s *server) signChatAttachments(message *message, viewerID int64) {
	if message == nil {
		return
	}
	for i := range message.Attachments {
		item := &message.Attachments[i]
		// An attachment without a persisted ID must never receive a download URL.
		item.URL = ""
		if item.ID > 0 {
			item.URL = s.mediaTicket(item.ID, viewerID)
		}
	}
}

func (s *server) signChatAttachmentList(items []mediax.Attachment, viewerID int64) {
	for i := range items {
		items[i].URL = ""
		if items[i].ID > 0 {
			items[i].URL = s.mediaTicket(items[i].ID, viewerID)
		}
	}
}
