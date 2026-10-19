package authx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestParseRequiresUnexpiredTokenAndUser(t *testing.T) {
	for _, claims := range []Claims{
		{UserID: 1},
		{UserID: 1, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Second))}},
		{UserID: 0, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}},
	} {
		raw, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("secret"))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := Parse("secret", raw); err == nil {
			t.Fatal("accepted missing expiry, expired token or missing user")
		}
	}
}

func TestSignAndParse(t *testing.T) {
	token, err := Sign("test-secret", 7, "mong", "Mong")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := Parse("test-secret", token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.UserID != 7 || claims.Username != "mong" || claims.DisplayName != "Mong" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestTokenFromRequestQueryOnlyForEvents(t *testing.T) {
	for _, tc := range []struct {
		method, path, header, expected string
	}{
		{http.MethodGet, "/api/events?token=event-token", "", "event-token"},
		{http.MethodGet, "/api/users/search?token=stolen-token", "", ""},
		{http.MethodPost, "/api/auth/logout?token=stolen-token", "", ""},
		{http.MethodPost, "/api/events?token=stolen-token", "", ""},
		{http.MethodGet, "/api/events/?token=stolen-token", "", ""},
		{http.MethodGet, "/api/users/search?token=stolen-token", "Bearer header-token", "header-token"},
		{http.MethodGet, "/api/events?token=stolen-token", "Bearer header-token", "header-token"},
	} {
		r := httptest.NewRequest(tc.method, tc.path, nil)
		if tc.header != "" {
			r.Header.Set("Authorization", tc.header)
		}
		if token := TokenFromRequest(r); token != tc.expected {
			t.Errorf("%s %s: got %q, expected %q", tc.method, tc.path, token, tc.expected)
		}
	}
}

func TestParseRejectsWrongSecret(t *testing.T) {
	token, err := Sign("one-secret", 1, "user", "User")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Parse("other-secret", token); err == nil {
		t.Fatal("expected wrong secret to fail")
	}
}
