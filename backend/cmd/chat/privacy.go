package main

import (
	"encoding/json"
	"io"
	"net/http"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
)

type userPrivacy struct {
	SearchableByUsername bool `json:"searchableByUsername"`
	SearchableByName     bool `json:"searchableByName"`
	SearchableByEmail    bool `json:"searchableByEmail"`
	AllowFriendRequests  bool `json:"allowFriendRequests"`
	ShowOnlineStatus     bool `json:"showOnlineStatus"`
}

func (s *server) getPrivacy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	var result userPrivacy
	err := s.db.QueryRow(r.Context(), `
        SELECT searchable_by_username, searchable_by_name, searchable_by_email,
               allow_friend_requests, show_online_status
        FROM users WHERE id=$1
    `, claims.UserID).Scan(
		&result.SearchableByUsername, &result.SearchableByName,
		&result.SearchableByEmail, &result.AllowFriendRequests, &result.ShowOnlineStatus,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load privacy settings")
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}

func (s *server) updatePrivacy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	// Require every setting; decoding omitted booleans to false could
	// silently disable all discovery after a partial client update.
	var required struct {
		SearchableByUsername *bool `json:"searchableByUsername"`
		SearchableByName     *bool `json:"searchableByName"`
		SearchableByEmail    *bool `json:"searchableByEmail"`
		AllowFriendRequests  *bool `json:"allowFriendRequests"`
		ShowOnlineStatus     *bool `json:"showOnlineStatus"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&required) != nil || decoder.Decode(new(any)) != io.EOF ||
		required.SearchableByUsername == nil || required.SearchableByName == nil ||
		required.SearchableByEmail == nil || required.AllowFriendRequests == nil ||
		required.ShowOnlineStatus == nil {
		httpx.Error(w, http.StatusBadRequest, "invalid privacy settings")
		return
	}
	body := userPrivacy{
		SearchableByUsername: *required.SearchableByUsername,
		SearchableByName:     *required.SearchableByName,
		SearchableByEmail:    *required.SearchableByEmail,
		AllowFriendRequests:  *required.AllowFriendRequests,
		ShowOnlineStatus:     *required.ShowOnlineStatus,
	}
	_, err := s.db.Exec(r.Context(), `
        UPDATE users
        SET searchable_by_username=$2, searchable_by_name=$3,
            searchable_by_email=$4, allow_friend_requests=$5,
            show_online_status=$6
        WHERE id=$1
    `, claims.UserID, body.SearchableByUsername, body.SearchableByName,
		body.SearchableByEmail, body.AllowFriendRequests, body.ShowOnlineStatus)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot update privacy settings")
		return
	}
	httpx.JSON(w, http.StatusOK, body)
}
