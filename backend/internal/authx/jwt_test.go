package authx

import (
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

func TestParseRejectsWrongSecret(t *testing.T) {
	token, err := Sign("one-secret", 1, "user", "User")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Parse("other-secret", token); err == nil {
		t.Fatal("expected wrong secret to fail")
	}
}
