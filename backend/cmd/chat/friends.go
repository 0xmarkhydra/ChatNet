package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/onesignalx"
	"github.com/jackc/pgx/v5"
)

type friendConnection struct {
	ID          int64     `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	Online      bool      `json:"online"`
	Status      string    `json:"status"`
	Direction   string    `json:"direction,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func orderedUserPair(a, b int64) (int64, int64) {
	if a < b {
		return a, b
	}
	return b, a
}

func (s *server) friendConnectionFor(ctx context.Context, userID, otherID int64) (friendConnection, error) {
	var item friendConnection
	var requestedBy int64
	var showOnline bool
	err := s.db.QueryRow(ctx, `
		SELECT u.id,u.username,u.display_name,u.show_online_status,fc.status,fc.requested_by,fc.updated_at
		FROM friend_connections fc
		JOIN users u ON u.id=$2
		WHERE fc.user_low=LEAST($1,$2)
		  AND fc.user_high=GREATEST($1,$2)
		  AND ($1=fc.user_low OR $1=fc.user_high)
		  AND NOT EXISTS (
		    SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$1 AND b.blocked_id=$2)
		      OR (b.blocked_id=$1 AND b.blocker_id=$2)
		  )
	`, userID, otherID).Scan(
		&item.ID,
		&item.Username,
		&item.DisplayName,
		&showOnline,
		&item.Status,
		&requestedBy,
		&item.UpdatedAt,
	)
	if err != nil {
		return friendConnection{}, err
	}
	item.Online = showOnline && s.redis.Exists(ctx, presenceKey(otherID)).Val() > 0
	if item.Status == "pending" {
		if requestedBy == userID {
			item.Direction = "outgoing"
		} else {
			item.Direction = "incoming"
		}
	}
	return item, nil
}

func (s *server) listFriends(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `
		SELECT u.id,u.username,u.display_name,u.show_online_status,fc.updated_at
		FROM friend_connections fc
		JOIN users u ON u.id=CASE WHEN fc.user_low=$1 THEN fc.user_high ELSE fc.user_low END
		WHERE fc.status='accepted'
		  AND ($1=fc.user_low OR $1=fc.user_high)
		  AND NOT EXISTS (
		    SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$1 AND b.blocked_id=u.id)
		      OR (b.blocked_id=$1 AND b.blocker_id=u.id)
		  )
		ORDER BY fc.updated_at DESC,u.username ASC
	`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load friends")
		return
	}
	defer rows.Close()

	items := []friendConnection{}
	for rows.Next() {
		var item friendConnection
		var showOnline bool
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &showOnline, &item.UpdatedAt); err != nil {
			continue
		}
		item.Status = "accepted"
		item.Online = showOnline && s.redis.Exists(r.Context(), presenceKey(item.ID)).Val() > 0
		items = append(items, item)
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) listFriendRequests(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `
		SELECT u.id,u.username,u.display_name,u.show_online_status,fc.requested_by,fc.updated_at
		FROM friend_connections fc
		JOIN users u ON u.id=CASE WHEN fc.user_low=$1 THEN fc.user_high ELSE fc.user_low END
		WHERE fc.status='pending'
		  AND ($1=fc.user_low OR $1=fc.user_high)
		  AND NOT EXISTS (
		    SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$1 AND b.blocked_id=u.id)
		      OR (b.blocked_id=$1 AND b.blocker_id=u.id)
		  )
		ORDER BY fc.updated_at DESC
	`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load friend requests")
		return
	}
	defer rows.Close()

	items := []friendConnection{}
	for rows.Next() {
		var item friendConnection
		var requestedBy int64
		var showOnline bool
		if err := rows.Scan(
			&item.ID,
			&item.Username,
			&item.DisplayName,
			&showOnline,
			&requestedBy,
			&item.UpdatedAt,
		); err != nil {
			continue
		}
		item.Status = "pending"
		item.Online = showOnline && s.redis.Exists(r.Context(), presenceKey(item.ID)).Val() > 0
		if requestedBy == claims.UserID {
			item.Direction = "outgoing"
		} else {
			item.Direction = "incoming"
		}
		items = append(items, item)
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) sendFriendRequest(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	otherID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if otherID == claims.UserID {
		httpx.Error(w, http.StatusBadRequest, "cannot add yourself")
		return
	}

	var username string
	if err := s.db.QueryRow(r.Context(), `SELECT username FROM users WHERE id=$1`, otherID).Scan(&username); err != nil {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}

	low, high := orderedUserPair(claims.UserID, otherID)
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot send friend request")
		return
	}
	defer tx.Rollback(r.Context())
	// Serialize by sender so send/cancel/re-send or concurrent API instances
	// cannot bypass the persistent rolling 24-hour friend-invitation budget.
	if _, err := tx.Exec(r.Context(), "SELECT pg_advisory_xact_lock($1::bigint)", claims.UserID); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot send friend request")
		return
	}
	var alreadyConnected bool
	err = tx.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM friend_connections
			WHERE user_low=$1 AND user_high=$2)`, low, high).Scan(&alreadyConnected)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot send friend request")
		return
	}
	var issuedToday int
	if !alreadyConnected {
		err = tx.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM friend_request_events
			WHERE sender_id=$1 AND created_at>NOW()-INTERVAL '24 hours'
		`, claims.UserID).Scan(&issuedToday)
		if err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot send friend request")
			return
		}
		if issuedToday >= maxDailyFriendRequests {
			httpx.Error(w, http.StatusTooManyRequests, "daily friend request limit reached")
			return
		}
	}
	tag, err := tx.Exec(r.Context(), `
		INSERT INTO friend_connections(user_low,user_high,requested_by,status,updated_at)
		SELECT $1,$2,$3,'pending',NOW()
		WHERE EXISTS(SELECT 1 FROM users WHERE id=$4 AND allow_friend_requests)
		  AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
		       (b.blocker_id=$3 AND b.blocked_id=$4) OR
		       (b.blocker_id=$4 AND b.blocked_id=$3))
		ON CONFLICT(user_low,user_high) DO NOTHING
	`, low, high, claims.UserID, otherID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot send friend request")
		return
	}
	if tag.RowsAffected() > 0 {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO friend_request_events(sender_id,recipient_id)
			VALUES($1,$2)`, claims.UserID, otherID); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot record friend request")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot save friend request")
		return
	}

	item, err := s.friendConnectionFor(r.Context(), claims.UserID, otherID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusForbidden, "cannot send friend request")
		} else {
			httpx.Error(w, http.StatusInternalServerError, "cannot load friend request")
		}
		return
	}
	if tag.RowsAffected() > 0 {
		s.publishConversationEvent(r.Context(), []int64{claims.UserID, otherID}, realtimeEvent{Type: "friend.updated"})
		s.sendPushAsync([]int64{otherID}, onesignalx.Notification{
			Title: "ChatNet",
			Body:  fmt.Sprintf("@%s đã gửi lời mời kết bạn.", claims.Username),
			URL:   "https://chat.codelocal.cloud/?tab=contacts",
			Data:  map[string]any{"type": "friend.request", "userId": claims.UserID},
		})
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (s *server) acceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	otherID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	low, high := orderedUserPair(claims.UserID, otherID)

	tag, err := s.db.Exec(r.Context(), `
		UPDATE friend_connections
		SET status='accepted',updated_at=NOW()
		WHERE user_low=$1 AND user_high=$2
		  AND status='pending'
		  AND requested_by<>$3
		  AND NOT EXISTS (
		    SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$3 AND b.blocked_id=CASE WHEN $3=$1 THEN $2 ELSE $1 END)
		      OR (b.blocked_id=$3 AND b.blocker_id=CASE WHEN $3=$1 THEN $2 ELSE $1 END)
		  )
	`, low, high, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot accept friend request")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "incoming friend request not found")
		return
	}

	item, err := s.friendConnectionFor(r.Context(), claims.UserID, otherID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load friend")
		return
	}
	s.publishConversationEvent(r.Context(), []int64{claims.UserID, otherID}, realtimeEvent{Type: "friend.updated"})
	s.sendPushAsync([]int64{otherID}, onesignalx.Notification{
		Title: "ChatNet",
		Body:  fmt.Sprintf("@%s đã chấp nhận lời mời kết bạn.", claims.Username),
		URL:   "https://chat.codelocal.cloud/?tab=contacts",
		Data:  map[string]any{"type": "friend.accepted", "userId": claims.UserID},
	})
	httpx.JSON(w, http.StatusOK, item)
}

func (s *server) removeFriendConnection(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	otherID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if otherID == claims.UserID {
		httpx.Error(w, http.StatusBadRequest, "invalid friend")
		return
	}

	low, high := orderedUserPair(claims.UserID, otherID)
	direction := r.URL.Query().Get("direction")
	if direction != "" && direction != "incoming" && direction != "outgoing" && direction != "accepted" {
		httpx.Error(w, http.StatusBadRequest, "invalid request direction")
		return
	}
	tag, err := s.db.Exec(r.Context(), `
		DELETE FROM friend_connections
		WHERE user_low=$1 AND user_high=$2
		  AND ($3='' OR ($3='accepted' AND status='accepted') OR (status='pending' AND (
		    ($3='outgoing' AND requested_by=$4) OR
		    ($3='incoming' AND requested_by<>$4)
		  )))
	`, low, high, direction, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot remove friend connection")
		return
	}
	if direction != "" && tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusConflict, "Lời mời đã thay đổi. Vui lòng kiểm tra lại.")
		return
	}
	s.publishConversationEvent(r.Context(), []int64{claims.UserID, otherID}, realtimeEvent{Type: "friend.updated"})
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "userId": otherID})
}
