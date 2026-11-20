package config

import "testing"

func TestRequiredSecretFailsClosedOutsideLocal(t *testing.T) {
	t.Setenv("CHATNET_ENV", "production")
	for _, key := range []string{"JWT_SECRET", "OTP_PEPPER"} {
		t.Setenv(key, "")
		if value, err := RequiredSecret(key); err == nil || value != "" {
			t.Fatalf("RequiredSecret(%q) = %q, %v; want empty value and error", key, value, err)
		}
	}
}

func TestRequiredSecretUsesSeparateLocalFallbacks(t *testing.T) {
	t.Setenv("CHATNET_ENV", "local")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("OTP_PEPPER", "")

	jwt, err := RequiredSecret("JWT_SECRET")
	if err != nil {
		t.Fatal(err)
	}
	otp, err := RequiredSecret("OTP_PEPPER")
	if err != nil {
		t.Fatal(err)
	}
	if jwt == "" || otp == "" || jwt == otp {
		t.Fatalf("local secrets are not separate: JWT_SECRET=%q OTP_PEPPER=%q", jwt, otp)
	}
}

func TestRequiredSecretUsesConfiguredValue(t *testing.T) {
	t.Setenv("CHATNET_ENV", "production")
	t.Setenv("JWT_SECRET", "configured-jwt")

	value, err := RequiredSecret("JWT_SECRET")
	if err != nil || value != "configured-jwt" {
		t.Fatalf("RequiredSecret(JWT_SECRET) = %q, %v", value, err)
	}
}
