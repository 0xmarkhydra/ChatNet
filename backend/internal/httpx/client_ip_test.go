package httpx

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPRequiresTrustedPeerAndValidForwardedAddress(t *testing.T) {
	networks, err := ParseTrustedProxyCIDRs("127.0.0.0/8")
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name       string
		remoteAddr string
		forwarded  string
		realIP     string
		want       string
	}{
		{name: "untrusted peer ignores forged header", remoteAddr: "192.0.2.10:1234", forwarded: "198.51.100.20", want: "192.0.2.10"},
		{name: "trusted chain uses nearest untrusted address", remoteAddr: "127.0.0.1:1234", forwarded: "203.0.113.7, 127.0.0.2", want: "203.0.113.7"},
		{name: "invalid forwarded values and real IP ignored", remoteAddr: "127.0.0.1:1234", forwarded: "spoofed", realIP: "198.51.100.99", want: "127.0.0.1"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = test.remoteAddr
			r.Header.Set("X-Forwarded-For", test.forwarded)
			if test.realIP != "" {
				r.Header.Set("X-Real-IP", test.realIP)
			}
			if got := ClientIP(r, networks); got != test.want {
				t.Fatalf("ClientIP() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestParseTrustedProxyCIDRsRejectsInvalidEntry(t *testing.T) {
	if _, err := ParseTrustedProxyCIDRs("not-an-ip"); err == nil {
		t.Fatal("invalid trusted proxy entry accepted")
	}
}
