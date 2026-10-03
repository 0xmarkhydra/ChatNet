package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
)

type profileState struct {
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	AvatarSet   bool      `json:"avatarSet"`
	CoverSet    bool      `json:"coverSet"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (s *server) profileForUserID(r *http.Request, userID int64) (profileState, error) {
	var profile profileState
	var avatarRef, coverRef string
	err := s.db.QueryRow(r.Context(), `
		SELECT username,display_name,COALESCE(avatar_ref,''),COALESCE(cover_ref,''),profile_updated_at
		FROM users WHERE id=$1
	`, userID).Scan(
		&profile.Username,
		&profile.DisplayName,
		&avatarRef,
		&coverRef,
		&profile.UpdatedAt,
	)
	if err != nil {
		return profileState{}, err
	}
	profile.AvatarSet = avatarRef != ""
	profile.CoverSet = coverRef != ""
	return profile, nil
}

func (s *server) getProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	profile, err := s.profileForUserID(r, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "profile not found")
		return
	}
	httpx.JSON(w, http.StatusOK, profile)
}

func (s *server) updateProfileMedia(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body struct {
		Kind       string                  `json:"kind"`
		Attachment *mediax.AttachmentInput `json:"attachment"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	kind := strings.ToLower(strings.TrimSpace(body.Kind))
	if kind != "avatar" && kind != "cover" {
		httpx.Error(w, http.StatusBadRequest, "kind must be avatar or cover")
		return
	}

	var storageRef any
	if body.Attachment != nil {
		items, err := mediax.ValidateAttachments(
			r.Context(),
			s.storage,
			"profile",
			claims.UserID,
			[]mediax.AttachmentInput{*body.Attachment},
			1,
		)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(items) != 1 || items[0].Kind != "image" {
			httpx.Error(w, http.StatusBadRequest, "profile media must be an image")
			return
		}
		storageRef = items[0].StorageRef
	}

	var err error
	switch kind {
	case "avatar":
		_, err = s.db.Exec(r.Context(), `
			UPDATE users SET avatar_ref=$1, profile_updated_at=NOW() WHERE id=$2
		`, storageRef, claims.UserID)
	case "cover":
		_, err = s.db.Exec(r.Context(), `
			UPDATE users SET cover_ref=$1, profile_updated_at=NOW() WHERE id=$2
		`, storageRef, claims.UserID)
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot update profile image")
		return
	}

	profile, err := s.profileForUserID(r, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load updated profile")
		return
	}
	httpx.JSON(w, http.StatusOK, profile)
}

func (s *server) profileAsset(w http.ResponseWriter, r *http.Request, kind string) {
	w.Header().Set("Cache-Control", "no-store")
	if s.storage == nil || !s.storage.Configured() {
		http.NotFound(w, r)
		return
	}

	username, err := url.PathUnescape(strings.TrimSpace(r.PathValue("username")))
	if err != nil || username == "" {
		http.NotFound(w, r)
		return
	}

	var storageRef string
	var query string
	switch kind {
	case "avatar":
		query = "SELECT COALESCE(avatar_ref,'') FROM users WHERE username=$1"
	case "cover":
		query = "SELECT COALESCE(cover_ref,'') FROM users WHERE username=$1"
	default:
		http.NotFound(w, r)
		return
	}
	if err := s.db.QueryRow(r.Context(), query, username).Scan(&storageRef); err != nil || storageRef == "" {
		http.NotFound(w, r)
		return
	}

	signed, err := s.storage.SignedGetURL(storageRef, 15*time.Minute)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	http.Redirect(w, r, signed, http.StatusTemporaryRedirect)
}
