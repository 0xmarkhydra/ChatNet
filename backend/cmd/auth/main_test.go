package main

import (
	"regexp"
	"testing"
)

func TestNewOTPIsSixDigits(t *testing.T) {
	pattern := regexp.MustCompile(`^[0-9]{6}$`)
	for i := 0; i < 20; i++ {
		code, err := newOTP()
		if err != nil {
			t.Fatal(err)
		}
		if !pattern.MatchString(code) {
			t.Fatalf("unexpected OTP: %q", code)
		}
	}
}

func TestOTPHashBindsTokenAndCode(t *testing.T) {
	s := &server{otpPepper: "test-pepper"}
	first := s.otpHash("token-one", "123456")
	if first == s.otpHash("token-one", "654321") {
		t.Fatal("OTP hash must change with code")
	}
	if first == s.otpHash("token-two", "123456") {
		t.Fatal("OTP hash must change with verification token")
	}
}

func TestMaskEmail(t *testing.T) {
	if got := maskEmail("someone@example.com"); got != "s******@example.com" {
		t.Fatalf("maskEmail()=%q", got)
	}
}

func TestValidUsername(t *testing.T) {
	for _, value := range []string{"mongdev", "mong.dev", "mong_dev", "mong-dev", "abc123"} {
		if !validUsername(value) {
			t.Fatalf("expected valid username %q", value)
		}
	}
	for _, value := range []string{"mong dev", "mong@", "MONG"} {
		if validUsername(value) {
			t.Fatalf("expected invalid username %q", value)
		}
	}
}
