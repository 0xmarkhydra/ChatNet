package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/languagecatalog"
)

type translateInput struct {
	Text      string `json:"text"`
	Target    string `json:"target"`
	MessageID int64  `json:"messageId,omitempty"`
}

type translationFailure struct {
	kind translationFailureKind
}

func (e *translationFailure) Error() string { return string(e.kind) }

type translationFailureKind string

const (
	translationTargetRequired     translationFailureKind = "target_required"
	translationTargetUnsupported  translationFailureKind = "target_unsupported"
	translationMessageNotFound    translationFailureKind = "message_not_found"
	translationTextInvalid        translationFailureKind = "text_invalid"
	translationNotConfigured      translationFailureKind = "not_configured"
	translationRateLimited        translationFailureKind = "rate_limited"
	translationLimiterUnavailable translationFailureKind = "limiter_unavailable"
	translationProviderBusy       translationFailureKind = "provider_busy"
	translationProviderFailed     translationFailureKind = "provider_failed"
)

var (
	errTranslationRateLimiterUnavailable = errors.New("rate limiter unavailable")
	errTranslationRateLimited            = errors.New("translation rate limit exceeded")
)

func (s *server) translateText(ctx context.Context, claims *authx.Claims, clientIP string, body translateInput) (map[string]string, *translationFailure) {
	target := languagecatalog.Normalize(body.Target)
	if target == "" {
		return nil, &translationFailure{kind: translationTargetRequired}
	}
	if !languagecatalog.Valid(target) {
		return nil, &translationFailure{kind: translationTargetUnsupported}
	}

	text := strings.TrimSpace(body.Text)
	userID := int64(0)
	if claims != nil {
		userID = claims.UserID
	}
	if body.MessageID > 0 {
		var stored string
		err := s.db.QueryRow(ctx, `
			SELECT m.text, COALESCE(mt.translated_text,'')
			FROM messages m
			JOIN conversation_members cm
			  ON cm.conversation_id=m.conversation_id AND cm.user_id=$2
			LEFT JOIN message_translations mt
			  ON mt.message_id=m.id AND mt.target_language=$3
			WHERE m.id=$1`,
			body.MessageID, userID, target,
		).Scan(&text, &stored)
		if err != nil {
			return nil, &translationFailure{kind: translationMessageNotFound}
		}
		if strings.TrimSpace(stored) != "" {
			return map[string]string{
				"translatedText": stored,
				"provider":       s.provider,
				"model":          s.model,
				"cache":          "thread",
			}, nil
		}
	}

	if text == "" || len(text) > 8000 {
		return nil, &translationFailure{kind: translationTextInvalid}
	}
	if s.apiKey == "" || s.baseURL == "" || s.model == "" {
		return nil, &translationFailure{kind: translationNotConfigured}
	}
	if err := s.checkTranslationLimit(ctx, userID, clientIP); err != nil {
		if errors.Is(err, errTranslationRateLimited) {
			return nil, &translationFailure{kind: translationRateLimited}
		}
		return nil, &translationFailure{kind: translationLimiterUnavailable}
	}

	key := s.cacheKey(text, target)
	if s.redis != nil {
		if cached, err := s.redis.Get(ctx, key).Result(); err == nil && cached != "" {
			if body.MessageID > 0 {
				_ = s.saveMessageTranslation(ctx, body.MessageID, target, cached)
			}
			return map[string]string{
				"translatedText": cached,
				"provider":       s.provider,
				"model":          s.model,
				"cache":          "hit",
			}, nil
		}
	}

	translated, usedStyle, err := s.callAIWithInstructionsContext(ctx, translationInstructions(languageName(target)), text, 700)
	if err != nil {
		var callErr *aiCallError
		if errors.As(err, &callErr) && callErr.Status == http.StatusServiceUnavailable && errors.Is(callErr.Err, errProviderBusy) {
			return nil, &translationFailure{kind: translationProviderBusy}
		}
		log.Printf("translate error provider=%s model=%s style=%s: %v", s.provider, s.model, s.apiStyle, err)
		return nil, &translationFailure{kind: translationProviderFailed}
	}

	if s.redis != nil {
		_ = s.redis.Set(ctx, key, translated, 24*time.Hour).Err()
	}
	if body.MessageID > 0 {
		if err := s.saveMessageTranslation(ctx, body.MessageID, target, translated); err != nil {
			log.Printf("save message translation failed message=%d target=%s: %v", body.MessageID, target, err)
		}
	}

	return map[string]string{
		"translatedText": translated,
		"provider":       s.provider,
		"model":          s.model,
		"apiStyle":       usedStyle,
		"cache":          "miss",
	}, nil
}
