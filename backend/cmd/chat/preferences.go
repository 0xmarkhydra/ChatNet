package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/languagecatalog"
)

type userPreferences struct {
	TargetLanguage string `json:"targetLanguage"`
	AutoTranslate  bool   `json:"autoTranslate"`
	AppLocale      string `json:"appLocale"`
}

func normalizeAppLocale(value string) (string, bool) {
	locale := strings.ToLower(strings.TrimSpace(value))
	if locale == "" || locale == "auto" {
		return "auto", true
	}
	if languagecatalog.Valid(locale) {
		return locale, true
	}
	return "", false
}

func (s *server) ensurePreferences(r *http.Request, userID int64) error {
	_, err := s.db.Exec(r.Context(), `
		INSERT INTO user_preferences(user_id, translation_target, auto_translate, app_locale)
		VALUES($1, 'en', TRUE, 'auto')
		ON CONFLICT(user_id) DO NOTHING
	`, userID)
	return err
}

func (s *server) getPreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	if err := s.ensurePreferences(r, claims.UserID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot initialize preferences")
		return
	}

	var prefs userPreferences
	if err := s.db.QueryRow(r.Context(), `
		SELECT translation_target, auto_translate, app_locale
		FROM user_preferences
		WHERE user_id=$1
	`, claims.UserID).Scan(&prefs.TargetLanguage, &prefs.AutoTranslate, &prefs.AppLocale); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load preferences")
		return
	}
	httpx.JSON(w, http.StatusOK, prefs)
}

func (s *server) updatePreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	var body userPreferences
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	target := languagecatalog.Normalize(body.TargetLanguage)
	if !languagecatalog.Valid(target) {
		httpx.Error(w, http.StatusBadRequest, "unsupported translation language")
		return
	}
	appLocale, ok := normalizeAppLocale(body.AppLocale)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "unsupported app locale")
		return
	}

	_, err := s.db.Exec(r.Context(), `
		INSERT INTO user_preferences(user_id, translation_target, auto_translate, app_locale, updated_at)
		VALUES($1,$2,$3,$4,NOW())
		ON CONFLICT(user_id) DO UPDATE SET
			translation_target=EXCLUDED.translation_target,
			auto_translate=EXCLUDED.auto_translate,
			app_locale=EXCLUDED.app_locale,
			updated_at=NOW()
	`, claims.UserID, target, body.AutoTranslate, appLocale)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot save preferences")
		return
	}

	httpx.JSON(w, http.StatusOK, userPreferences{
		TargetLanguage: target,
		AutoTranslate:  body.AutoTranslate,
		AppLocale:      appLocale,
	})
}
