package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

func (s *server) registerScheduledMessages(mux *http.ServeMux) {
	const queue = "/api/conversations/{id}/scheduled-messages"
	for pattern, handler := range map[string]http.HandlerFunc{
		"GET " + queue:                      s.listScheduledMessages,
		"POST " + queue:                     s.scheduleMessage,
		"PATCH " + queue + "/{scheduleId}":  s.moveScheduledMessage,
		"DELETE " + queue + "/{scheduleId}": s.removeScheduledMessage,
	} {
		mux.Handle(pattern, authx.CachedSessionMiddleware(s.jwtSecret, s.db, s.redis, handler))
	}
}

func scheduledJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			httpx.Error(w, http.StatusRequestEntityTooLarge, "scheduled message request is too large")
		} else {
			httpx.Error(w, http.StatusBadRequest, "invalid scheduled message request")
		}
		return false
	}
	if decoder.Decode(new(any)) != io.EOF {
		httpx.Error(w, http.StatusBadRequest, "invalid scheduled message request")
		return false
	}
	return true
}

func scheduledError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errScheduledBody), errors.Is(err, errScheduledTime), errors.Is(err, errScheduledID), errors.Is(err, errScheduledRoom):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, errScheduledForbidden):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case errors.Is(err, pgx.ErrNoRows):
		httpx.Error(w, http.StatusNotFound, "pending scheduled message not found")
	case errors.Is(err, errScheduledEncrypted), errors.Is(err, errScheduledConflict):
		httpx.Error(w, http.StatusConflict, err.Error())
	case errors.Is(err, errScheduledLimit):
		httpx.Error(w, http.StatusTooManyRequests, err.Error())
	default:
		log.Printf("scheduled message operation failed: %T", err)
		httpx.Error(w, http.StatusServiceUnavailable, "scheduled messages are temporarily unavailable")
	}
}

func (s *server) listScheduledMessages(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	room, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	ctx := r.Context()
	var member bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM conversation_members WHERE user_id=$1 AND conversation_id=$2
	)`, claims.UserID, room).Scan(&member); err != nil {
		scheduledError(w, err)
		return
	}
	if !member {
		scheduledError(w, errScheduledForbidden)
		return
	}
	rows, err := s.db.Query(ctx, "SELECT "+scheduledColumns+` FROM scheduled_messages m
		WHERE m.user_id=$1 AND m.conversation_id=$2 AND state='pending'
		  AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.user_id=$1 AND cm.conversation_id=$2)
		ORDER BY send_at,id LIMIT $3`, claims.UserID, room, scheduledMessageLimit)
	if err != nil {
		scheduledError(w, err)
		return
	}
	defer rows.Close()
	items := make([]scheduledMessage, 0)
	for rows.Next() {
		m, err := scanScheduled(rows)
		if err != nil {
			scheduledError(w, err)
			return
		}
		items = append(items, m)
	}
	if err := rows.Err(); err != nil {
		scheduledError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) scheduleMessage(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	room, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var in scheduleMessageInput
	if !scheduledJSON(w, r, &in) {
		return
	}
	m, err := s.createScheduledMessage(r.Context(), room, claims.UserID, in)
	if err != nil {
		scheduledError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusCreated, m)
}

func (s *server) moveScheduledMessage(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	room, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	id, ok := parseID(w, r.PathValue("scheduleId"))
	if !ok {
		return
	}
	var in struct {
		SendAt time.Time `json:"sendAt"`
	}
	if !scheduledJSON(w, r, &in) {
		return
	}
	m, err := s.rescheduleMessage(r.Context(), room, claims.UserID, id, in.SendAt)
	if err != nil {
		scheduledError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, m)
}

func (s *server) removeScheduledMessage(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	room, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	id, ok := parseID(w, r.PathValue("scheduleId"))
	if !ok {
		return
	}
	_, err := s.cancelScheduledMessage(r.Context(), room, claims.UserID, id)
	if err != nil {
		scheduledError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
