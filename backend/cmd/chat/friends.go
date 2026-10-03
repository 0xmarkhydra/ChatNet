package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/onesignalx"
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
	err := s.db.QueryRow(ctx, `
		SELECT u.id,u.username,u.display_name,fc.status,fc.requested_by,fc.updated_at
		FROM friend_connections fc
		JOIN users u ON u.id=$2
		WHERE fc.user_low=LEAST($1,$2)
		  AND fc.user_high=GREATEST($1,$2)
		  AND ($1=fc.user_low OR $1=fc.user_high)
	`, userID, otherID).Scan(
		&item.ID,
		&item.Username,
		&item.DisplayName,
		&item.Status,
		&requestedBy,
		&item.UpdatedAt,
	)
	if err != nil {
		return friendConnection{}, err
	}
	item.Online = s.redis.Exists(ctx, presenceKey(otherID)).Val() > 0
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
		SELECT u.id,u.username,u.display_name,fc.updated_at
		FROM friend_connections fc
		JOIN users u ON u.id=CASE WHEN fc.user_low=$1 THEN fc.user_high ELSE fc.user_low END
		WHERE fc.status='accepted'
		  AND ($1=fc.user_low OR $1=fc.user_high)
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
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &item.UpdatedAt); err != nil {
			continue
		}
		item.Status = "accepted"
		item.Online = s.redis.Exists(r.Context(), presenceKey(item.ID)).Val() > 0
		items = append(items, item)
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) listFriendRequests(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	rows, err := s.db.Query(r.Context(), `
		SELECT u.id,u.username,u.display_name,fc.requested_by,fc.updated_at
		FROM friend_connections fc
		JOIN users u ON u.id=CASE WHEN fc.user_low=$1 THEN fc.user_high ELSE fc.user_low END
		WHERE fc.status='pending'
		  AND ($1=fc.user_low OR $1=fc.user_high)
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
		if err := rows.Scan(
			&item.ID,
			&item.Username,
			&item.DisplayName,
			&requestedBy,
			&item.UpdatedAt,
		); err != nil {
			continue
		}
		item.Status = "pending"
		item.Online = s.redis.Exists(r.Context(), presenceKey(item.ID)).Val() > 0
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
	tag, err := s.db.Exec(r.Context(), `
		INSERT INTO friend_connections(user_low,user_high,requested_by,status,updated_at)
		VALUES($1,$2,$3,'pending',NOW())
		ON CONFLICT(user_low,user_high) DO NOTHING
	`, low, high, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot send friend request")
		return
	}

	item, err := s.friendConnectionFor(r.Context(), claims.UserID, otherID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot load friend request")
		return
	}
	if tag.RowsAffected() > 0 {
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
	if _, err := s.db.Exec(r.Context(), `
		DELETE FROM friend_connections
		WHERE user_low=$1 AND user_high=$2
	`, low, high); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "cannot remove friend connection")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "userId": otherID})
}
