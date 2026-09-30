package authx

import "testing"

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
