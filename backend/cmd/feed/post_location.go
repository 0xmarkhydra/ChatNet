package main

import (
	"math"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const publicLocationRequired = "Bài công khai cần vị trí hiện tại hợp lệ. Hãy bật dịch vụ vị trí và thử lại."

type postLocation struct {
	Latitude   *float64  `json:"latitude"`
	Longitude  *float64  `json:"longitude"`
	Accuracy   *float64  `json:"accuracy"`
	CapturedAt time.Time `json:"capturedAt"`
	PlaceName  string    `json:"placeName,omitempty"`
}

func validPostLocationNow(location *postLocation) bool {
	return validPostLocation(location, time.Now())
}

func validPostLocation(location *postLocation, now time.Time) bool {
	if location == nil || location.Latitude == nil || location.Longitude == nil || location.Accuracy == nil {
		return false
	}
	location.PlaceName = strings.TrimSpace(location.PlaceName)
	if utf8.RuneCountInString(location.PlaceName) > 160 || strings.IndexFunc(location.PlaceName, unicode.IsControl) >= 0 {
		location.PlaceName = ""
	}
	lat, lon, acc := *location.Latitude, *location.Longitude, *location.Accuracy
	return !math.IsNaN(lat) && !math.IsNaN(lon) && !math.IsNaN(acc) &&
		lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
		acc > 0 && acc <= 20040000 && !location.CapturedAt.IsZero() &&
		!location.CapturedAt.Before(now.Add(-2*time.Minute)) && !location.CapturedAt.After(now.Add(15*time.Second))
}
