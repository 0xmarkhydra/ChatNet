package main

import (
	"encoding/json"
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

func validWallpaper(v string) bool {
	switch v {
	case "default", "blue", "green", "rose", "sand":
		return true
	}
	return false
}

func (s *server) setChatWallpaper(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var input struct {
		Wallpaper string `json:"wallpaper"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 256)).Decode(&input) != nil || !validWallpaper(input.Wallpaper) {
		httpx.Error(w, 400, "invalid wallpaper")
		return
	}
	result, err := s.db.Exec(r.Context(), `UPDATE conversation_members SET chat_wallpaper=$3 WHERE conversation_id=$1 AND user_id=$2`, id, claims.UserID, input.Wallpaper)
	if err != nil {
		httpx.Error(w, 503, "cannot save wallpaper")
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(w, 403, "not a conversation member")
		return
	}
	s.publishConversationEvent(r.Context(), []int64{claims.UserID}, realtimeEvent{Type: "conversation.updated", ConversationID: id})
	httpx.JSON(w, 200, input)
}
