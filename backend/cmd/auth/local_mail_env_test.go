package main

import (
	"strings"
	"testing"
)

func TestParseLocalMailEnvSelectsOnlyMailerSettings(t *testing.T) {
	data := strings.Join([]string{
		"# This fixture must not read or use real credentials.",
		"RESEND_API_KEY=\"re_example_for_test\"",
		"CHATNET_EMAIL_FROM='SocCo <noreply@verified.example>'",
		"RESEND_API_BASE_URL=https://api.resend.com # provider",
		"DATABASE_URL=postgres://production.example/",
		"JWT_SECRET=do-not-import",
	}, "\n")
	values := parseLocalMailEnv(strings.NewReader(data))
	if got := values["RESEND_API_KEY"]; got != "re_example_for_test" {
		t.Fatal("wrong mail key parsing")
	}
	if got := values["CHATNET_EMAIL_FROM"]; got != "SocCo <noreply@verified.example>" {
		t.Fatalf("wrong sender parsing: %q", got)
	}
	if got := values["RESEND_API_BASE_URL"]; got != "https://api.resend.com" {
		t.Fatalf("wrong base URL: %q", got)
	}
	if len(values) != 3 {
		t.Fatalf("unexpected non-mail config imported: %v", len(values))
	}
}
func TestLocalMailEnvDisabledInProduction(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://database.invalid")
	if values := localMailEnv(); len(values) != 0 {
		t.Fatal("local file must not be used when DATABASE_URL is configured")
	}
}
func TestLocalMailEnvDisabledOnRailway(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("RAILWAY_ENVIRONMENT", "production")
	if values := localMailEnv(); len(values) != 0 {
		t.Fatal("local mail file must not be used on Railway")
	}
}
