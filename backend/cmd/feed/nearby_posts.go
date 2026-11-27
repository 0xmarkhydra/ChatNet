package main

import (
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"time"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"chatnet/internal/mediax"
)

type nearbyPostCursor struct {
	DistanceMeters *int64 `json:"distanceMeters"`
	ID             int64  `json:"id"`
}

type nearbyPostsInput struct {
	Latitude  *float64          `json:"latitude"`
	Longitude *float64          `json:"longitude"`
	RadiusKm  float64           `json:"radiusKm"`
	Limit     int               `json:"limit"`
	Cursor    *nearbyPostCursor `json:"cursor,omitempty"`
}

func (input nearbyPostsInput) valid() bool {
	if input.Latitude == nil || input.Longitude == nil ||
		math.Abs(*input.Latitude) > 90 || math.Abs(*input.Longitude) > 180 ||
		math.IsNaN(*input.Latitude) || math.IsNaN(*input.Longitude) ||
		math.IsNaN(input.RadiusKm) || input.RadiusKm < 1 || input.RadiusKm > 50 ||
		input.Limit < 1 || input.Limit > 30 {
		return false
	}
	return input.Cursor == nil || (input.Cursor.DistanceMeters != nil && *input.Cursor.DistanceMeters >= 0 &&
		float64(*input.Cursor.DistanceMeters) <= input.RadiusKm*1000 && input.Cursor.ID > 0)
}

type nearbyPost struct {
	ID                int64               `json:"id"`
	Author            string              `json:"author"`
	AuthorDisplayName string              `json:"authorDisplayName"`
	Content           string              `json:"content"`
	Visibility        string              `json:"visibility"`
	DistanceMeters    int64               `json:"distanceMeters"`
	Attachments       []mediax.Attachment `json:"attachments,omitempty"`
}

// Only opted-in public publication coordinates are used. Do not save the viewer's
// search location, and keep it out of request URLs and response payloads.
// The two-part cursor follows distance ASC, id DESC, including tied distances.
func (s *server) nearbyPosts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	claims, _ := authx.ClaimsFromContext(r.Context())
	input := nearbyPostsInput{RadiusKm: 5, Limit: 15}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || !input.valid() {
		httpx.Error(w, http.StatusBadRequest, "invalid nearby post search")
		return
	}
	var cursorDistance int64 = -1
	var cursorID int64
	if input.Cursor != nil {
		cursorDistance = *input.Cursor.DistanceMeters
		cursorID = input.Cursor.ID
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	// CASE protects numeric casts against missing, malformed, or out-of-range legacy JSON.
	// Haversine handles longitude wrapping across the antimeridian and polar locations.
	rows, err := s.db.Query(ctx, `
 WITH eligible AS (
  SELECT p.id, p.user_id, p.content,
   CASE WHEN jsonb_typeof(p.publish_location->'latitude')='number'
    THEN CASE WHEN (p.publish_location->>'latitude')::numeric BETWEEN -90 AND 90
     THEN (p.publish_location->>'latitude')::double precision END END AS lat,
   CASE WHEN jsonb_typeof(p.publish_location->'longitude')='number'
    THEN CASE WHEN (p.publish_location->>'longitude')::numeric BETWEEN -180 AND 180
     THEN (p.publish_location->>'longitude')::double precision END END AS lon
  FROM posts p
  WHERE p.visibility='public' AND p.publish_location IS NOT NULL AND `+feedAccessSQL+`
 ), distances AS (
  SELECT id,user_id,content,
   ROUND(12742000 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
    POWER(SIN(RADIANS(lat-$1::double precision)/2),2)
    + COS(RADIANS($1::double precision))*COS(RADIANS(lat))
      *POWER(SIN(RADIANS(lon-$3::double precision)/2),2)
   )))))::bigint AS meters
  FROM eligible WHERE lat IS NOT NULL AND lon IS NOT NULL
    AND ABS(lat-$1::double precision) <= $4::double precision/110.0
 )
 SELECT d.id,u.username,COALESCE(u.display_name,''),d.content,d.meters
 FROM distances d JOIN users u ON u.id=d.user_id
 WHERE d.meters <= $4::double precision*1000
 AND (d.meters > $5::bigint OR (d.meters=$5 AND d.id<$6::bigint))
 ORDER BY d.meters ASC,d.id DESC LIMIT $7`,
		*input.Latitude, claims.UserID, *input.Longitude, input.RadiusKm, cursorDistance, cursorID, input.Limit+1)
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "nearby posts unavailable")
		return
	}
	defer rows.Close()
	posts := make([]nearbyPost, 0, input.Limit+1)
	for rows.Next() {
		p := nearbyPost{Visibility: "public"}
		if err := rows.Scan(&p.ID, &p.Author, &p.AuthorDisplayName, &p.Content, &p.DistanceMeters); err != nil {
			httpx.Error(w, http.StatusServiceUnavailable, "nearby posts unavailable")
			return
		}
		posts = append(posts, p)
	}
	if rows.Err() != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "nearby posts unavailable")
		return
	}
	rows.Close()
	var next *nearbyPostCursor
	if len(posts) > input.Limit {
		posts = posts[:input.Limit]
		last := posts[len(posts)-1]
		next = &nearbyPostCursor{DistanceMeters: &last.DistanceMeters, ID: last.ID}
	}
	for i := range posts {
		posts[i].Attachments = s.postAttachments(ctx, posts[i].ID)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"posts": posts, "nextCursor": next})
}
