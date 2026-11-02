package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type contactMetadata struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Nickname    string `json:"nickname"`
	Note        string `json:"note"`
	Favorite    bool   `json:"favorite"`
}

func (s *server) listContactMetadata(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	w.Header().Set("Cache-Control", "no-store")
	rows, err := s.db.Query(r.Context(), `
		SELECT u.id,u.username,u.display_name,
			   COALESCE(meta.nickname,''), COALESCE(meta.note,''),COALESCE(meta.favorite,FALSE)
		FROM friend_connections fc
		JOIN users u ON u.id=CASE WHEN fc.user_low=$1 THEN fc.user_high ELSE fc.user_low END
		LEFT JOIN friend_contact_metadata meta ON meta.owner_id=$1 AND meta.contact_id=u.id
		WHERE fc.status='accepted' AND (fc.user_low=$1 OR fc.user_high=$1)
		  AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		    (b.blocker_id=$1 AND b.blocked_id=u.id)
		    OR (b.blocker_id=u.id AND b.blocked_id=$1))
		ORDER BY COALESCE(meta.favorite,FALSE) DESC,u.username ASC
		LIMIT 2000`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot load contact metadata")
		return
	}
	defer rows.Close()
	items := []contactMetadata{}
	for rows.Next() {
		var item contactMetadata
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &item.Nickname, &item.Note, &item.Favorite); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "cannot load contact metadata")
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot load contact metadata")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (s *server) updateContactMetadata(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	w.Header().Set("Cache-Control", "no-store")
	target, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if target == claims.UserID {
		httpx.Error(w, http.StatusBadRequest, "cannot edit yourself as a contact")
		return
	}
	var request struct {
		Nickname *string `json:"nickname"`
		Note     *string `json:"note"`
		Favorite *bool   `json:"favorite"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&request) != nil || decoder.Decode(new(any)) != io.EOF ||
		request.Nickname == nil || request.Note == nil || request.Favorite == nil {
		httpx.Error(w, http.StatusBadRequest, "invalid contact metadata")
		return
	}
	nick := strings.TrimSpace(*request.Nickname)
	note := strings.TrimSpace(*request.Note)
	if utf8.RuneCountInString(nick) > 60 || utf8.RuneCountInString(note) > 1500 {
		httpx.Error(w, http.StatusBadRequest, "nickname or note too long")
		return
	}
	var result contactMetadata
	err := s.db.QueryRow(r.Context(), `
		WITH permitted AS (
		  SELECT u.id,u.username,u.display_name
		  FROM users u JOIN friend_connections fc
		    ON fc.user_low=LEAST($1::bigint,u.id)
		   AND fc.user_high=GREATEST($1::bigint,u.id)
		   AND fc.status='accepted'
		  WHERE u.id=$2
		    AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
		      (b.blocker_id=$1 AND b.blocked_id=u.id)
		      OR (b.blocker_id=u.id AND b.blocked_id=$1))
		),
		saved AS (
		  INSERT INTO friend_contact_metadata(owner_id,contact_id,nickname,note,favorite,updated_at)
		  SELECT $1,id,$3,$4,$5,NOW() FROM permitted
		  ON CONFLICT(owner_id,contact_id)
		  DO UPDATE SET nickname=EXCLUDED.nickname,note=EXCLUDED.note,
		                favorite=EXCLUDED.favorite,updated_at=NOW()
		  RETURNING contact_id,nickname,note,favorite
		)
		SELECT p.id,p.username,p.display_name,s.nickname,s.note,s.favorite
		FROM permitted p JOIN saved s ON s.contact_id=p.id
	`, claims.UserID, target, nick, note, *request.Favorite).Scan(
		&result.ID, &result.Username, &result.DisplayName, &result.Nickname, &result.Note, &result.Favorite)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "accepted contact not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "cannot save contact metadata")
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}
