package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/config"
	"chatnet/internal/database"
	"chatnet/internal/httpx"
	"chatnet/internal/onesignalx"
	"chatnet/internal/ratelimit"
	"chatnet/internal/redisx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/livekit/protocol/auth"
	lk "github.com/livekit/protocol/livekit"
	"github.com/redis/go-redis/v9"
)

const (
	liveKitTokenTTL = 5 * time.Minute
	cryptoRelayTTL  = 2 * time.Hour
	ringTimeout     = 75 * time.Second
)

type server struct {
	db               *pgxpool.Pool
	redis            *redis.Client
	jwtSecret        string
	liveKitURL       string
	liveKitAPIKey    string
	liveKitAPISecret string
	webURL           string
	push             *onesignalx.Client
	limiter          ratelimit.Limiter
}

type callSession struct {
	ID             string     `json:"id"`
	ConversationID int64      `json:"conversationId"`
	CreatedBy      int64      `json:"createdBy"`
	MediaType      string     `json:"mediaType"`
	Status         string     `json:"status"`
	RoomName       string     `json:"-"`
	CreatedAt      time.Time  `json:"createdAt"`
	StartedAt      *time.Time `json:"startedAt,omitempty"`
	EndedAt        *time.Time `json:"endedAt,omitempty"`
}

type membership struct {
	ConversationType string
	Role             string
}

type participant struct {
	UserID     int64      `json:"userId"`
	Role       string     `json:"role"`
	InvitedAt  time.Time  `json:"invitedAt"`
	JoinedAt   *time.Time `json:"joinedAt,omitempty"`
	LeftAt     *time.Time `json:"leftAt,omitempty"`
	DeclinedAt *time.Time `json:"declinedAt,omitempty"`
}

type callView struct {
	callSession
	Role       string `json:"role"`
	Joined     bool   `json:"joined"`
	Incoming   bool   `json:"incoming"`
	CanEnd     bool   `json:"canEnd"`
	E2EEReady  bool   `json:"e2eeReady"`
	Configured bool   `json:"configured"`
}

type callEvent struct {
	Type           string       `json:"type"`
	ConversationID int64        `json:"conversationId"`
	CallID         string       `json:"callId"`
	Call           *callSession `json:"call,omitempty"`
}

type publicJWK struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type publicKeyRecord struct {
	UserID    int64     `json:"userId"`
	PublicKey publicJWK `json:"publicKey"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type keyEnvelope struct {
	SenderUserID    int64     `json:"senderUserId"`
	RecipientUserID int64     `json:"recipientUserId"`
	Generation      string    `json:"generation"`
	IV              string    `json:"iv"`
	Ciphertext      string    `json:"ciphertext"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type bearerTransport struct {
	base  http.RoundTripper
	token string
}

func (t bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	clone.Header = req.Header.Clone()
	clone.Header.Set("Authorization", "Bearer "+t.token)
	return t.base.RoundTrip(clone)
}

func main() {
	ctx := context.Background()
	db, err := database.Open(ctx, config.Env("DATABASE_URL", "postgres://chatnet:chatnet@localhost:5432/chatnet?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		log.Fatal(err)
	}

	rdb, err := redisx.Open(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer rdb.Close()

	s := &server{
		db:               db,
		redis:            rdb,
		jwtSecret:        config.Env("JWT_SECRET", "dev-secret-change-me"),
		liveKitURL:       strings.TrimSpace(config.Env("LIVEKIT_URL", "")),
		liveKitAPIKey:    strings.TrimSpace(config.Env("LIVEKIT_API_KEY", "")),
		liveKitAPISecret: strings.TrimSpace(config.Env("LIVEKIT_API_SECRET", "")),
		webURL:           strings.TrimRight(config.Env("CHATNET_WEB_URL", "https://chat.codelocal.cloud"), "/"),
		push:             onesignalx.New(config.Env("ONESIGNAL_APP_ID", ""), config.Env("ONESIGNAL_REST_API_KEY", "")),
	}
	s.limiter.Redis = rdb
	go s.reapExpiredCalls(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.Handle("POST /api/calls", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.createCall)))
	mux.Handle("GET /api/calls/current", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.currentCalls)))
	mux.Handle("GET /api/calls/{id}", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.getCall)))
	mux.Handle("GET /api/calls/{id}/participants", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.listParticipants)))
	mux.Handle("POST /api/calls/{id}/join", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.joinCall)))
	mux.Handle("POST /api/calls/{id}/decline", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.declineCall)))
	mux.Handle("POST /api/calls/{id}/leave", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.leaveCall)))
	mux.Handle("POST /api/calls/{id}/end", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.endCall)))
	mux.Handle("POST /api/calls/{id}/e2ee/public-key", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.putPublicKey)))
	mux.Handle("GET /api/calls/{id}/e2ee/public-keys", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.listPublicKeys)))
	mux.Handle("POST /api/calls/{id}/e2ee/envelopes", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.putEnvelope)))
	mux.Handle("GET /api/calls/{id}/e2ee/envelope", authx.Middleware(s.jwtSecret, http.HandlerFunc(s.getEnvelope)))

	port := config.Env("PORT", "8085")
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("call service listening on :%s", port)
	log.Fatal(httpServer.ListenAndServe())
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	configured := s.liveKitConfigured()
	httpx.JSON(w, http.StatusOK, map[string]any{
		"status":            "ok",
		"service":           "call",
		"ready":             configured,
		"livekitConfigured": configured,
	})
}

func (s *server) createCall(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.liveKitConfigured() {
		httpx.Error(w, http.StatusServiceUnavailable, "secure calling is not configured")
		return
	}
	if !s.allow(w, r, "call-create", claims.UserID, 10, time.Minute) {
		return
	}

	var body struct {
		ConversationID int64  `json:"conversationId"`
		MediaType      string `json:"mediaType"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.MediaType = strings.ToLower(strings.TrimSpace(body.MediaType))
	if body.ConversationID <= 0 || (body.MediaType != "audio" && body.MediaType != "video") {
		httpx.Error(w, http.StatusBadRequest, "conversationId and mediaType=audio|video are required")
		return
	}
	creatorMember, err := s.membership(r.Context(), body.ConversationID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not a conversation member")
		return
	}

	members, err := s.conversationMembers(r.Context(), body.ConversationID)
	if err != nil || len(members) < 2 {
		httpx.Error(w, http.StatusConflict, "call requires at least two conversation members")
		return
	}

	callID, err := secureID("call_", 16)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create call")
		return
	}
	roomName, err := secureID("cn_", 16)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create call")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create call")
		return
	}
	defer tx.Rollback(r.Context())

	var call callSession
	err = tx.QueryRow(r.Context(), `
		INSERT INTO call_sessions(id,conversation_id,created_by,media_type,status,livekit_room)
		VALUES($1,$2,$3,$4,'ringing',$5)
		ON CONFLICT DO NOTHING
		RETURNING id,conversation_id,created_by,media_type,status,livekit_room,created_at,started_at,ended_at`,
		callID, body.ConversationID, claims.UserID, body.MediaType, roomName,
	).Scan(
		&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType, &call.Status,
		&call.RoomName, &call.CreatedAt, &call.StartedAt, &call.EndedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusConflict, "conversation already has an active call")
		return
	}
	if err != nil {
		log.Printf("create call failed user=%d conversation=%d: %v", claims.UserID, body.ConversationID, err)
		httpx.Error(w, http.StatusInternalServerError, "cannot create call")
		return
	}

	memberIDs := make([]int64, 0, len(members))
	for _, item := range members {
		role := "participant"
		joined := false
		if item.UserID == claims.UserID {
			role = "host"
			joined = true
		} else if item.Role == "owner" || item.Role == "admin" {
			role = "cohost"
		}
		var joinedAt any
		if joined {
			joinedAt = time.Now()
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO call_participants(call_id,user_id,role,joined_at,left_at,declined_at)
			VALUES($1,$2,$3,$4,NULL,NULL)`, call.ID, item.UserID, role, joinedAt); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot invite call participants")
			return
		}
		memberIDs = append(memberIDs, item.UserID)
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot create call")
		return
	}

	s.publishCallEvent(r.Context(), memberIDs, "call.created", call)
	recipients := make([]int64, 0, len(memberIDs)-1)
	for _, id := range memberIDs {
		if id != claims.UserID {
			recipients = append(recipients, id)
		}
	}
	s.sendPushAsync(recipients, onesignalx.Notification{
		Title: "ChatNet",
		Body:  map[string]string{"audio": "Bạn có cuộc gọi thoại đến.", "video": "Bạn có cuộc gọi video đến."}[body.MediaType],
		URL:   fmt.Sprintf("%s/?conversation=%d&call=%s", s.webURL, body.ConversationID, url.QueryEscape(call.ID)),
		Data: map[string]any{
			"type": "call.created", "callId": call.ID, "conversationId": body.ConversationID, "mediaType": body.MediaType,
		},
	})

	_ = creatorMember
	httpx.JSON(w, http.StatusCreated, call)
}

func (s *server) currentCalls(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `
		SELECT cs.id,cs.conversation_id,cs.created_by,cs.media_type,cs.status,cs.livekit_room,
		       cs.created_at,cs.started_at,cs.ended_at,cp.role,cp.joined_at,
		       c.type,cm.role
		FROM call_sessions cs
		JOIN call_participants cp ON cp.call_id=cs.id AND cp.user_id=$1
		JOIN conversations c ON c.id=cs.conversation_id
		JOIN conversation_members cm ON cm.conversation_id=cs.conversation_id AND cm.user_id=$1
		WHERE cs.status IN ('ringing','active') AND cp.declined_at IS NULL
		ORDER BY cs.created_at DESC
		LIMIT 20`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load calls")
		return
	}
	defer rows.Close()

	items := []callView{}
	for rows.Next() {
		var call callSession
		var role, conversationType, memberRole string
		var joinedAt *time.Time
		if rows.Scan(&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType, &call.Status, &call.RoomName,
			&call.CreatedAt, &call.StartedAt, &call.EndedAt, &role, &joinedAt, &conversationType, &memberRole) != nil {
			continue
		}
		items = append(items, callView{
			callSession: call,
			Role:        role, Joined: joinedAt != nil,
			Incoming:   call.CreatedBy != claims.UserID && joinedAt == nil,
			CanEnd:     conversationType == "direct" || call.CreatedBy == claims.UserID || memberRole == "owner" || memberRole == "admin",
			E2EEReady:  s.redis.Exists(r.Context(), publicKeyRedisKey(call.ID, claims.UserID)).Val() > 0,
			Configured: s.liveKitConfigured(),
		})
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) getCall(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	call, member, err := s.authorizedCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "call not found")
		return
	}
	if err != nil || member.Role == "" {
		httpx.Error(w, http.StatusForbidden, "not allowed to access this call")
		return
	}
	httpx.JSON(w, http.StatusOK, call)
}

func (s *server) listParticipants(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	call, _, err := s.authorizedCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to access this call")
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT user_id,role,invited_at,joined_at,left_at,declined_at
		FROM call_participants WHERE call_id=$1 ORDER BY invited_at,user_id`, call.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load call participants")
		return
	}
	defer rows.Close()
	items := []participant{}
	for rows.Next() {
		var item participant
		if rows.Scan(&item.UserID, &item.Role, &item.InvitedAt, &item.JoinedAt, &item.LeftAt, &item.DeclinedAt) == nil {
			items = append(items, item)
		}
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) joinCall(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "call-join", claims.UserID, 30, time.Minute) {
		return
	}
	if !s.liveKitConfigured() {
		httpx.Error(w, http.StatusServiceUnavailable, "secure calling is not configured")
		return
	}

	call, member, err := s.authorizedCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "call not found")
		return
	}
	if err != nil || member.Role == "" {
		httpx.Error(w, http.StatusForbidden, "not allowed to join this call")
		return
	}
	if call.Status != "ringing" && call.Status != "active" {
		httpx.Error(w, http.StatusConflict, "call is no longer active")
		return
	}

	role, declined, err := s.callParticipantRole(r.Context(), call.ID, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not invited to this call")
		return
	}
	if declined {
		httpx.Error(w, http.StatusConflict, "call invitation was declined")
		return
	}

	if _, err := s.db.Exec(r.Context(), `
		UPDATE call_participants SET joined_at=COALESCE(joined_at,NOW()),left_at=NULL
		WHERE call_id=$1 AND user_id=$2 AND declined_at IS NULL`, call.ID, claims.UserID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot join call")
		return
	}
	if claims.UserID != call.CreatedBy {
		_, _ = s.db.Exec(r.Context(), `
			UPDATE call_sessions SET status='active',started_at=COALESCE(started_at,NOW())
			WHERE id=$1 AND status='ringing'`, call.ID)
		call.Status = "active"
	}

	identity := participantIdentity(claims.UserID)
	token, err := s.liveKitJoinToken(call.RoomName, identity)
	if err != nil {
		log.Printf("issue livekit token failed call=%s user=%d: %v", call.ID, claims.UserID, err)
		httpx.Error(w, http.StatusInternalServerError, "cannot issue call credentials")
		return
	}

	s.publishCallEvent(r.Context(), s.callUserIDs(r.Context(), call.ID), "call.updated", call)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"callId":              call.ID,
		"serverUrl":           s.liveKitURL,
		"token":               token,
		"roomName":            call.RoomName,
		"participantIdentity": identity,
		"role":                role,
		"e2eeRequired":        true,
		"expiresInSeconds":    int(liveKitTokenTTL.Seconds()),
	})
}

func (s *server) declineCall(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	call, member, err := s.authorizedCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to access this call")
		return
	}
	if call.Status != "ringing" && call.Status != "active" {
		httpx.JSON(w, http.StatusOK, call)
		return
	}
	if _, err := s.db.Exec(r.Context(), `
		UPDATE call_participants SET declined_at=COALESCE(declined_at,NOW()),left_at=COALESCE(left_at,NOW())
		WHERE call_id=$1 AND user_id=$2`, call.ID, claims.UserID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot decline call")
		return
	}

	if member.ConversationType == "direct" || claims.UserID == call.CreatedBy {
		if err := s.finishCall(r.Context(), &call, "cancelled"); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot cancel call")
			return
		}
		s.afterCallFinished(call)
	} else {
		s.publishCallEvent(r.Context(), s.callUserIDs(r.Context(), call.ID), "call.updated", call)
	}
	httpx.JSON(w, http.StatusOK, call)
}

func (s *server) leaveCall(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	call, member, err := s.authorizedCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "call not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to access this call")
		return
	}
	if member.ConversationType == "direct" && (call.Status == "ringing" || call.Status == "active") {
		if err := s.finishCall(r.Context(), &call, "ended"); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "cannot leave call")
			return
		}
		s.afterCallFinished(call)
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	_, _ = s.db.Exec(r.Context(), `
		UPDATE call_participants SET left_at=NOW()
		WHERE call_id=$1 AND user_id=$2 AND left_at IS NULL`, call.ID, claims.UserID)
	s.publishCallEvent(r.Context(), s.callUserIDs(r.Context(), call.ID), "call.updated", call)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *server) endCall(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	call, member, err := s.authorizedCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "call not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to access this call")
		return
	}
	canEnd := member.ConversationType == "direct" || claims.UserID == call.CreatedBy || member.Role == "owner" || member.Role == "admin"
	if !canEnd {
		httpx.Error(w, http.StatusForbidden, "only the call host or group admin can end this call")
		return
	}
	if call.Status == "ended" || call.Status == "cancelled" {
		httpx.JSON(w, http.StatusOK, call)
		return
	}
	if err := s.finishCall(r.Context(), &call, "ended"); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot end call")
		return
	}
	s.afterCallFinished(call)
	httpx.JSON(w, http.StatusOK, call)
}

func (s *server) finishCall(ctx context.Context, call *callSession, status string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE call_sessions SET status=$2,ended_at=NOW() WHERE id=$1`, call.ID, status); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE call_participants SET left_at=COALESCE(left_at,NOW()) WHERE call_id=$1`, call.ID); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	call.Status = status
	now := time.Now()
	call.EndedAt = &now
	return nil
}

func (s *server) afterCallFinished(call callSession) {
	users := s.callUserIDs(context.Background(), call.ID)
	s.publishCallEvent(context.Background(), users, "call.ended", call)
	s.cleanupCallCrypto(context.Background(), call.ID, users)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.deleteLiveKitRoom(ctx, call.RoomName); err != nil && s.liveKitConfigured() {
		log.Printf("livekit room cleanup failed call=%s: %v", call.ID, err)
	}
}

func (s *server) reapExpiredCalls(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.expireRingingCalls(ctx)
		}
	}
}

func (s *server) expireRingingCalls(ctx context.Context) {
	cutoff := time.Now().Add(-ringTimeout)
	rows, err := s.db.Query(ctx, `
		UPDATE call_sessions
		SET status='cancelled',ended_at=NOW()
		WHERE status='ringing' AND created_at < $1
		RETURNING id,conversation_id,created_by,media_type,status,livekit_room,created_at,started_at,ended_at`, cutoff)
	if err != nil {
		log.Printf("expire ringing calls failed: %v", err)
		return
	}
	calls := []callSession{}
	for rows.Next() {
		var call callSession
		if rows.Scan(&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType, &call.Status,
			&call.RoomName, &call.CreatedAt, &call.StartedAt, &call.EndedAt) == nil {
			calls = append(calls, call)
		}
	}
	rows.Close()
	for _, call := range calls {
		_, _ = s.db.Exec(ctx, `UPDATE call_participants SET left_at=COALESCE(left_at,NOW()) WHERE call_id=$1`, call.ID)
		s.afterCallFinished(call)
	}
}

func (s *server) putPublicKey(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "call-key", claims.UserID, 120, time.Minute) {
		return
	}
	call, _, err := s.authorizedActiveCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to exchange call keys")
		return
	}
	var body struct {
		PublicKey publicJWK `json:"publicKey"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || !validP256PublicJWK(body.PublicKey) {
		httpx.Error(w, http.StatusBadRequest, "invalid P-256 public key")
		return
	}
	record := publicKeyRecord{UserID: claims.UserID, PublicKey: body.PublicKey, UpdatedAt: time.Now().UTC()}
	raw, _ := json.Marshal(record)
	if err := s.redis.Set(r.Context(), publicKeyRedisKey(call.ID, claims.UserID), raw, cryptoRelayTTL).Err(); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "key relay unavailable")
		return
	}
	_ = s.redis.Del(r.Context(), envelopeRedisKey(call.ID, claims.UserID)).Err()
	s.publishRawEvent(r.Context(), []int64{call.CreatedBy}, callEvent{Type: "call.e2ee.key-request", ConversationID: call.ConversationID, CallID: call.ID})
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "expiresInSeconds": int(cryptoRelayTTL.Seconds())})
}

func (s *server) listPublicKeys(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	call, _, err := s.authorizedActiveCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to exchange call keys")
		return
	}
	items := []publicKeyRecord{}
	for _, userID := range s.callUserIDs(r.Context(), call.ID) {
		raw, err := s.redis.Get(r.Context(), publicKeyRedisKey(call.ID, userID)).Bytes()
		if err != nil {
			continue
		}
		var record publicKeyRecord
		if json.Unmarshal(raw, &record) == nil && validP256PublicJWK(record.PublicKey) {
			items = append(items, record)
		}
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) putEnvelope(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	if !s.allow(w, r, "call-envelope", claims.UserID, 300, time.Minute) {
		return
	}
	call, _, err := s.authorizedActiveCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to exchange call keys")
		return
	}
	if claims.UserID != call.CreatedBy {
		httpx.Error(w, http.StatusForbidden, "only the call creator can wrap encryption keys")
		return
	}
	var body struct {
		RecipientUserID int64  `json:"recipientUserId"`
		Generation      string `json:"generation"`
		IV              string `json:"iv"`
		Ciphertext      string `json:"ciphertext"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || body.RecipientUserID <= 0 || !validGeneration(body.Generation) || !validEnvelope(body.IV, body.Ciphertext) {
		httpx.Error(w, http.StatusBadRequest, "invalid encrypted key envelope")
		return
	}
	if _, declined, err := s.callParticipantRole(r.Context(), call.ID, body.RecipientUserID); err != nil || declined {
		httpx.Error(w, http.StatusForbidden, "recipient is not an active call participant")
		return
	}
	envelope := keyEnvelope{
		SenderUserID: claims.UserID, RecipientUserID: body.RecipientUserID,
		Generation: body.Generation, IV: body.IV, Ciphertext: body.Ciphertext, UpdatedAt: time.Now().UTC(),
	}
	raw, _ := json.Marshal(envelope)
	if err := s.redis.Set(r.Context(), envelopeRedisKey(call.ID, body.RecipientUserID), raw, cryptoRelayTTL).Err(); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "key relay unavailable")
		return
	}
	s.publishRawEvent(r.Context(), []int64{body.RecipientUserID}, callEvent{Type: "call.e2ee.updated", ConversationID: call.ConversationID, CallID: call.ID})
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *server) getEnvelope(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	call, _, err := s.authorizedActiveCall(r.Context(), strings.TrimSpace(r.PathValue("id")), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "not allowed to exchange call keys")
		return
	}
	raw, err := s.redis.Get(r.Context(), envelopeRedisKey(call.ID, claims.UserID)).Bytes()
	if errors.Is(err, redis.Nil) {
		httpx.JSON(w, http.StatusOK, map[string]any{"envelope": nil})
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "key relay unavailable")
		return
	}
	var envelope keyEnvelope
	if json.Unmarshal(raw, &envelope) != nil || envelope.RecipientUserID != claims.UserID {
		httpx.Error(w, http.StatusServiceUnavailable, "invalid key relay state")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"envelope": envelope})
}

func (s *server) authorizedActiveCall(ctx context.Context, callID string, userID int64) (callSession, membership, error) {
	call, member, err := s.authorizedCall(ctx, callID, userID)
	if err != nil {
		return call, member, err
	}
	if call.Status != "ringing" && call.Status != "active" {
		return call, member, errors.New("call is inactive")
	}
	_, declined, err := s.callParticipantRole(ctx, call.ID, userID)
	if err != nil || declined {
		return call, member, errors.New("participant is inactive")
	}
	return call, member, nil
}

func (s *server) authorizedCall(ctx context.Context, callID string, userID int64) (callSession, membership, error) {
	if !validOpaqueID(callID, "call_") {
		return callSession{}, membership{}, pgx.ErrNoRows
	}
	call, err := s.loadCall(ctx, callID)
	if err != nil {
		return callSession{}, membership{}, err
	}
	member, err := s.membership(ctx, call.ConversationID, userID)
	if err != nil {
		return callSession{}, membership{}, err
	}
	return call, member, nil
}

func (s *server) loadCall(ctx context.Context, callID string) (callSession, error) {
	var call callSession
	err := s.db.QueryRow(ctx, `
		SELECT id,conversation_id,created_by,media_type,status,livekit_room,created_at,started_at,ended_at
		FROM call_sessions WHERE id=$1`, callID,
	).Scan(&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType, &call.Status,
		&call.RoomName, &call.CreatedAt, &call.StartedAt, &call.EndedAt)
	return call, err
}

func (s *server) membership(ctx context.Context, conversationID, userID int64) (membership, error) {
	var member membership
	err := s.db.QueryRow(ctx, `
		SELECT c.type,cm.role FROM conversation_members cm
		JOIN conversations c ON c.id=cm.conversation_id
		WHERE cm.conversation_id=$1 AND cm.user_id=$2`, conversationID, userID,
	).Scan(&member.ConversationType, &member.Role)
	return member, err
}

func (s *server) conversationMembers(ctx context.Context, conversationID int64) ([]participant, error) {
	rows, err := s.db.Query(ctx, `SELECT user_id,role,joined_at FROM conversation_members WHERE conversation_id=$1 ORDER BY user_id`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []participant{}
	for rows.Next() {
		var item participant
		var joined time.Time
		if err := rows.Scan(&item.UserID, &item.Role, &joined); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *server) callParticipantRole(ctx context.Context, callID string, userID int64) (string, bool, error) {
	var role string
	var declinedAt *time.Time
	err := s.db.QueryRow(ctx, `SELECT role,declined_at FROM call_participants WHERE call_id=$1 AND user_id=$2`, callID, userID).Scan(&role, &declinedAt)
	return role, declinedAt != nil, err
}

func (s *server) callUserIDs(ctx context.Context, callID string) []int64 {
	rows, err := s.db.Query(ctx, `SELECT user_id FROM call_participants WHERE call_id=$1 ORDER BY user_id`, callID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func (s *server) allow(w http.ResponseWriter, r *http.Request, scope string, userID int64, limit int64, window time.Duration) bool {
	allowed, _, err := s.limiter.Allow(r.Context(), scope, fmt.Sprintf("u:%d", userID), limit, window)
	if err != nil {
		log.Printf("call rate limiter failed scope=%s user=%d: %v", scope, userID, err)
		httpx.Error(w, http.StatusServiceUnavailable, "call service temporarily unavailable")
		return false
	}
	if !allowed {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(window.Seconds())))
		httpx.Error(w, http.StatusTooManyRequests, "too many call requests")
		return false
	}
	return true
}

func (s *server) publishCallEvent(ctx context.Context, userIDs []int64, eventType string, call callSession) {
	copy := call
	s.publishRawEvent(ctx, userIDs, callEvent{Type: eventType, ConversationID: call.ConversationID, CallID: call.ID, Call: &copy})
}

func (s *server) publishRawEvent(ctx context.Context, userIDs []int64, event callEvent) {
	raw, _ := json.Marshal(event)
	for _, id := range userIDs {
		_ = s.redis.Publish(ctx, fmt.Sprintf("chatnet:user:%d", id), raw).Err()
	}
}

func (s *server) sendPushAsync(userIDs []int64, notification onesignalx.Notification) {
	if !s.push.Configured() || len(userIDs) == 0 {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		rows, err := s.db.Query(ctx, `SELECT subscription_id::text FROM push_subscriptions WHERE user_id = ANY($1::bigint[]) ORDER BY updated_at DESC`, userIDs)
		if err != nil {
			return
		}
		defer rows.Close()
		ids := []string{}
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil && id != "" {
				ids = append(ids, id)
			}
		}
		if err := s.push.SendToSubscriptions(ctx, ids, notification); err != nil {
			log.Printf("call push notification failed: %v", err)
		}
	}()
}

func (s *server) liveKitConfigured() bool {
	return strings.HasPrefix(s.liveKitURL, "wss://") && s.liveKitAPIKey != "" && len(s.liveKitAPISecret) >= 16
}

func (s *server) liveKitJoinToken(roomName, identity string) (string, error) {
	if !s.liveKitConfigured() {
		return "", errors.New("livekit is not configured")
	}
	canPublish, canSubscribe, canPublishData := true, true, true
	grant := &auth.VideoGrant{RoomJoin: true, Room: roomName, CanPublish: &canPublish, CanSubscribe: &canSubscribe, CanPublishData: &canPublishData}
	return auth.NewAccessToken(s.liveKitAPIKey, s.liveKitAPISecret).
		SetVideoGrant(grant).SetIdentity(identity).SetValidFor(liveKitTokenTTL).ToJWT()
}

func (s *server) deleteLiveKitRoom(ctx context.Context, roomName string) error {
	if !s.liveKitConfigured() || roomName == "" {
		return nil
	}
	token, err := auth.NewAccessToken(s.liveKitAPIKey, s.liveKitAPISecret).
		SetVideoGrant(&auth.VideoGrant{RoomCreate: true}).SetValidFor(time.Minute).ToJWT()
	if err != nil {
		return err
	}
	baseURL := "https://" + strings.TrimPrefix(s.liveKitURL, "wss://")
	client := &http.Client{Timeout: 5 * time.Second, Transport: bearerTransport{base: http.DefaultTransport, token: token}}
	service := lk.NewRoomServiceProtobufClient(baseURL, client)
	_, err = service.DeleteRoom(ctx, &lk.DeleteRoomRequest{Room: roomName})
	return err
}

func (s *server) cleanupCallCrypto(ctx context.Context, callID string, userIDs []int64) {
	keys := make([]string, 0, len(userIDs)*2)
	for _, id := range userIDs {
		keys = append(keys, publicKeyRedisKey(callID, id), envelopeRedisKey(callID, id))
	}
	if len(keys) > 0 {
		_ = s.redis.Del(ctx, keys...).Err()
	}
}

func participantIdentity(userID int64) string { return fmt.Sprintf("u_%d", userID) }
func publicKeyRedisKey(callID string, userID int64) string {
	return fmt.Sprintf("chatnet:call:%s:e2ee:pub:%d", callID, userID)
}
func envelopeRedisKey(callID string, userID int64) string {
	return fmt.Sprintf("chatnet:call:%s:e2ee:env:%d", callID, userID)
}

func validP256PublicJWK(key publicJWK) bool {
	if key.Kty != "EC" || key.Crv != "P-256" || len(key.X) < 40 || len(key.X) > 64 || len(key.Y) < 40 || len(key.Y) > 64 {
		return false
	}
	x, errX := base64.RawURLEncoding.DecodeString(key.X)
	y, errY := base64.RawURLEncoding.DecodeString(key.Y)
	return errX == nil && errY == nil && len(x) == 32 && len(y) == 32
}

func validEnvelope(iv, ciphertext string) bool {
	ivRaw, errIV := base64.RawURLEncoding.DecodeString(iv)
	cipherRaw, errCipher := base64.RawURLEncoding.DecodeString(ciphertext)
	return errIV == nil && errCipher == nil && len(ivRaw) == 12 && len(cipherRaw) >= 16 && len(cipherRaw) <= 2048
}

func validGeneration(value string) bool {
	if len(value) < 8 || len(value) > 80 {
		return false
	}
	for _, r := range value {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

func secureID(prefix string, size int) (string, error) {
	if size < 16 {
		return "", errors.New("secure id requires at least 128 bits")
	}
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buf), nil
}

func validOpaqueID(value, prefix string) bool {
	if !strings.HasPrefix(value, prefix) {
		return false
	}
	raw := strings.TrimPrefix(value, prefix)
	if len(raw) != 32 {
		return false
	}
	_, err := hex.DecodeString(raw)
	return err == nil
}
