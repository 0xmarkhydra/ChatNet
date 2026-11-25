package searchx

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const maxCursorLength = 512

type PageRequest struct {
	Limit  int
	Sort   string
	Since  *time.Time
	Cursor string
}

// ParsePageRequest detects the cursor-based search contract. Requests that use
// only legacy parameters keep their existing response shape.
func ParsePageRequest(query url.Values) (PageRequest, bool, error) {
	_, hasSort := query["sort"]
	_, hasCursor := query["cursor"]
	_, hasSince := query["since"]
	if !hasSort && !hasCursor && !hasSince {
		return PageRequest{}, false, nil
	}

	page := PageRequest{Limit: 10, Sort: "relevance", Cursor: query.Get("cursor")}
	if raw := query.Get("limit"); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 50 {
			return PageRequest{}, true, errors.New("invalid limit")
		}
		page.Limit = limit
	}
	if raw := query.Get("sort"); raw != "" {
		if raw != "relevance" && raw != "newest" {
			return PageRequest{}, true, errors.New("invalid sort")
		}
		page.Sort = raw
	}
	if len(page.Cursor) > maxCursorLength {
		return PageRequest{}, true, errors.New("invalid cursor")
	}
	if raw := query.Get("since"); raw != "" {
		since, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return PageRequest{}, true, errors.New("invalid since")
		}
		_, offset := since.Zone()
		if offset != 0 {
			return PageRequest{}, true, errors.New("invalid since")
		}
		since = since.UTC()
		page.Since = &since
	}
	return page, true, nil
}

func EncodeCursor[T any](value T) (string, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(encoded), nil
}

func DecodeCursor[T any](value string) (T, error) {
	var decoded T
	if value == "" || len(value) > maxCursorLength {
		return decoded, errors.New("invalid cursor")
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(raw) == 0 || strings.TrimSpace(string(raw)) == "" {
		return decoded, errors.New("invalid cursor")
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return decoded, errors.New("invalid cursor")
	}
	return decoded, nil
}
