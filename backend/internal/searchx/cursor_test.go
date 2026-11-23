package searchx

import (
	"net/url"
	"testing"
)

func TestParsePageRequest(t *testing.T) {
	legacy, enabled, err := ParsePageRequest(url.Values{"q": {"bird"}, "limit": {"20"}})
	if err != nil || enabled || legacy.Limit != 0 {
		t.Fatalf("legacy request = %+v, enabled=%v, err=%v", legacy, enabled, err)
	}

	page, enabled, err := ParsePageRequest(url.Values{
		"limit": {"10"}, "sort": {"newest"}, "since": {"2026-11-01T00:00:00Z"}, "cursor": {"abc"},
	})
	if err != nil || !enabled || page.Limit != 10 || page.Sort != "newest" || page.Since == nil || page.Cursor != "abc" {
		t.Fatalf("search page = %+v, enabled=%v, err=%v", page, enabled, err)
	}

	for _, query := range []url.Values{{"sort": {"relevance"}, "limit": {"0"}}, {"sort": {"random"}}, {"sort": {"newest"}, "since": {"yesterday"}}, {"sort": {"newest"}, "since": {"2026-11-01T01:00:00+01:00"}}} {
		if _, _, err := ParsePageRequest(query); err == nil {
			t.Fatalf("invalid page request accepted: %v", query)
		}
	}
}

func TestCursorRoundTripAndRejectMalformed(t *testing.T) {
	type cursor struct {
		Rank int    `json:"rank"`
		Name string `json:"name"`
	}
	want := cursor{Rank: 3, Name: "bird"}
	encoded, err := EncodeCursor(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := DecodeCursor[cursor](encoded)
	if err != nil || got != want {
		t.Fatalf("cursor round trip = %+v, err=%v", got, err)
	}
	if _, err := DecodeCursor[cursor]("not a cursor"); err == nil {
		t.Fatal("malformed cursor accepted")
	}
}
