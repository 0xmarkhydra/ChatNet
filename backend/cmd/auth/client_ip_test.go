package main

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPIgnoresForwardedHeadersWithoutTrustedProxy(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "192.0.2.10:1234"
	r.Header.Set("X-Forwarded-For", "198.51.100.20")
	r.Header.Set("X-Real-IP", "198.51.100.21")

	if got := clientIP(r, nil); got != "192.0.2.10" {
		t.Fatalf("clientIP() = %q, want remote address", got)
	}
}

func TestClientIPUsesRightmostUntrustedForwardedAddress(t *testing.T) {
	networks, err := parseTrustedProxyCIDRs("127.0.0.0/8")
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "127.0.0.1:1234"
	r.Header.Set("X-Forwarded-For", "203.0.113.7, 127.0.0.2")

	if got := clientIP(r, networks); got != "203.0.113.7" {
		t.Fatalf("clientIP() = %q, want original client address", got)
	}
}

func TestParseTrustedProxyCIDRs(t *testing.T) {
	if networks, err := parseTrustedProxyCIDRs("127.0.0.1, 2001:db8::/32"); err != nil || len(networks) != 2 {
		t.Fatalf("parse trusted proxies = %v, %v", networks, err)
	}
	if _, err := parseTrustedProxyCIDRs("not-an-ip"); err == nil {
		t.Fatal("invalid trusted proxy entry accepted")
	}
}
