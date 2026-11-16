package main

import (
	"encoding/json"
	"io"
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

// Consent does not change encryption mode. The server only switches a direct
// room when two active devices have consented AND a Commit+Welcome are atomically
// recorded. A member's account session authorizes their own opt-in.
func (s *server) approveMLSPilot(w http.ResponseWriter, r *http.Request) {
	if !mlsRelayEnabled(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body struct {
		DeviceID string `json:"deviceId"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF ||
		!mlsRelayUUID.MatchString(body.DeviceID) {
		httpx.Error(w, http.StatusBadRequest, "invalid MLS pilot consent")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS consent unavailable")
		return
	}
	defer tx.Rollback(r.Context())
	var typ string
	if err = tx.QueryRow(r.Context(), `
    SELECT type FROM conversations WHERE id=$1 FOR UPDATE
  `, conversationID).Scan(&typ); err != nil || typ != "direct" {
		httpx.Error(w, http.StatusForbidden, "pilot consent requires direct conversation")
		return
	}
	var epoch int64
	if err = tx.QueryRow(r.Context(), `
    SELECT COALESCE((SELECT epoch FROM e2ee_mls_groups WHERE conversation_id=$1),0)
  `, conversationID).Scan(&epoch); err != nil || epoch != 0 {
		httpx.Error(w, http.StatusConflict, "MLS cutover already started")
		return
	}
	var active bool
	if err = tx.QueryRow(r.Context(), `
    SELECT EXISTS(
      SELECT 1 FROM e2ee_devices d
      JOIN conversation_members cm ON cm.user_id=d.user_id
      WHERE d.id=$1::uuid AND d.user_id=$2 AND d.revoked_at IS NULL
        AND cm.conversation_id=$3
    )
  `, body.DeviceID, claims.UserID, conversationID).Scan(&active); err != nil || !active {
		httpx.Error(w, http.StatusForbidden, "MLS consent device is unauthorized")
		return
	}
	if _, err = tx.Exec(r.Context(), `
    INSERT INTO e2ee_pilot_consents(conversation_id,user_id,device_id)
    VALUES($1,$2,$3::uuid)
    ON CONFLICT(conversation_id,user_id) DO UPDATE
      SET device_id=EXCLUDED.device_id, created_at=NOW()
  `, conversationID, claims.UserID, body.DeviceID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot store MLS consent")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot commit MLS consent")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{"approved": true})
}

func (s *server) getMLSPilotConsents(w http.ResponseWriter, r *http.Request) {
	if !mlsRelayEnabled(w) {
		return
	}
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var typ string
	if err := s.db.QueryRow(r.Context(), `
    SELECT c.type FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.id=$1 AND cm.user_id=$2
  `, conversationID, claims.UserID).Scan(&typ); err != nil || typ != "direct" {
		httpx.Error(w, http.StatusForbidden, "not an eligible direct conversation member")
		return
	}
	var own, peer int
	if err := s.db.QueryRow(r.Context(), `
    SELECT
      COUNT(*) FILTER (WHERE c.user_id=$2),
      COUNT(*) FILTER (WHERE c.user_id<>$2)
    FROM e2ee_pilot_consents c
    JOIN e2ee_devices d ON d.id=c.device_id AND d.user_id=c.user_id
    WHERE c.conversation_id=$1 AND d.revoked_at IS NULL
  `, conversationID, claims.UserID).Scan(&own, &peer); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "MLS consents unavailable")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ownApproved":  own == 1,
		"peerApproved": peer == 1,
	})
}
