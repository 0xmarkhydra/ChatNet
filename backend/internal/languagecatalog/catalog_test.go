package languagecatalog

import "testing"

func TestCatalogAcceptsISO639Languages(t *testing.T) {
	if len(supported) != 184 {
		t.Fatalf("expected 184 ISO 639-1 languages, got %d", len(supported))
	}
	for _, code := range []string{"en", "vi", "ja", "ar", "hi", "sw", "zu", "is", "eu"} {
		if !Valid(code) {
			t.Fatalf("expected %q to be supported", code)
		}
	}
	for _, code := range []string{"", "eng", "xx", "zh-Hant", "123"} {
		if Valid(code) {
			t.Fatalf("expected %q to be rejected", code)
		}
	}
}

func TestPromptNameFallback(t *testing.T) {
	if got := PromptName("vi"); got != "Vietnamese" {
		t.Fatalf("PromptName(vi)=%q", got)
	}
	if got := PromptName("zu"); got != "the language identified by ISO 639-1 code zu" {
		t.Fatalf("PromptName(zu)=%q", got)
	}
}
