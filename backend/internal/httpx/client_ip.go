package httpx

import (
	"fmt"
	"net"
	"net/http"
	"strings"
)

func ParseTrustedProxyCIDRs(raw string) ([]*net.IPNet, error) {
	var networks []*net.IPNet
	for _, value := range strings.Split(raw, ",") {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if ip := net.ParseIP(value); ip != nil {
			bits := 128
			if ipv4 := ip.To4(); ipv4 != nil {
				ip = ipv4
				bits = 32
			}
			networks = append(networks, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
			continue
		}
		_, network, err := net.ParseCIDR(value)
		if err != nil {
			return nil, fmt.Errorf("invalid CHATNET_TRUSTED_PROXY_CIDRS entry %q: %w", value, err)
		}
		networks = append(networks, network)
	}
	return networks, nil
}

func ClientIP(r *http.Request, trustedProxyCIDRs []*net.IPNet) string {
	remote := requestHost(r)
	if !trustedProxyAddress(remote, trustedProxyCIDRs) {
		return remote
	}
	forwarded := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	forwarded = append(forwarded, remote)
	for index := len(forwarded) - 1; index >= 0; index-- {
		value := strings.TrimSpace(forwarded[index])
		ip := net.ParseIP(value)
		if ip == nil {
			continue
		}
		if !trustedProxyAddress(value, trustedProxyCIDRs) {
			return ip.String()
		}
	}
	return remote
}

func requestHost(r *http.Request) string {
	remote := strings.TrimSpace(r.RemoteAddr)
	host, _, err := net.SplitHostPort(remote)
	if err == nil && host != "" {
		return host
	}
	return remote
}

func trustedProxyAddress(value string, networks []*net.IPNet) bool {
	value = strings.TrimSpace(value)
	if host, _, err := net.SplitHostPort(value); err == nil {
		value = host
	}
	ip := net.ParseIP(value)
	if ip == nil {
		return false
	}
	for _, network := range networks {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}
