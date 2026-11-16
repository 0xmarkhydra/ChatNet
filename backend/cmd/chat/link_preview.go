package main

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"chatnet/internal/httpx"
	"golang.org/x/net/html"
)

const maxLinkPreviewHTML = 512 << 10

type linkPreview struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Image       string `json:"image,omitempty"`
	SiteName    string `json:"siteName,omitempty"`
	Domain      string `json:"domain"`
}

var blockedPreviewRanges = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("224.0.0.0/4"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("2001:db8::/32"),
}

var linkPreviewSlots = make(chan struct{}, 8)

func validPreviewURL(u *url.URL) bool {
	if u == nil || (u.Scheme != "https" && u.Scheme != "http") ||
		u.User != nil || u.Hostname() == "" || len(u.String()) > 2048 {
		return false
	}
	host := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") ||
		strings.HasSuffix(host, ".test") || net.ParseIP(host) != nil {
		return false
	}
	if port := u.Port(); port != "" && port != "80" && port != "443" {
		return false
	}
	return true
}

func publicPreviewIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	if !addr.IsGlobalUnicast() || addr.IsPrivate() || addr.IsLoopback() ||
		addr.IsLinkLocalUnicast() || addr.IsMulticast() {
		return false
	}
	for _, prefix := range blockedPreviewRanges {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

// Resolve at connection time and dial the validated address, so DNS rebinding
// cannot redirect the server to local services or cloud instance metadata.
func linkPreviewDial(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	if !validPreviewURL(&url.URL{Scheme: "https", Host: net.JoinHostPort(host, port)}) {
		return nil, errors.New("link preview host not allowed")
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	if len(ips) == 0 {
		return nil, errors.New("link preview host has no addresses")
	}
	for _, ip := range ips {
		if !publicPreviewIP(ip.IP) {
			return nil, errors.New("link preview host resolves to a restricted address")
		}
	}
	dialer := &net.Dialer{Timeout: 3 * time.Second}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
}

func fetchLinkPreview(ctx context.Context, target *url.URL) (*linkPreview, error) {
	transport := &http.Transport{
		Proxy:                  nil,
		DialContext:            linkPreviewDial,
		DisableKeepAlives:      true,
		TLSHandshakeTimeout:    3 * time.Second,
		ResponseHeaderTimeout:  4 * time.Second,
		MaxResponseHeaderBytes: 16 << 10,
	}
	defer transport.CloseIdleConnections()
	client := &http.Client{
		Transport: transport,
		Timeout:   6 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 || !validPreviewURL(req.URL) {
				return errors.New("link preview redirect not allowed")
			}
			return nil
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "text/html, application/xhtml+xml")
	req.Header.Set("User-Agent", "ChatNet-LinkPreview/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK ||
		!strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/html") {
		return nil, errors.New("link preview page unavailable")
	}
	preview := parseLinkPreview(io.LimitReader(resp.Body, maxLinkPreviewHTML), resp.Request.URL)
	if preview.Title == "" && preview.Description == "" {
		return nil, errors.New("link preview metadata missing")
	}
	preview.URL = target.String()
	preview.Domain = target.Hostname()
	if preview.Title == "" {
		preview.Title = preview.Domain
	}
	return &preview, nil
}

func clippedPreviewText(text string, maxRunes int) string {
	text = strings.Join(strings.Fields(text), " ")
	if utf8.RuneCountInString(text) <= maxRunes {
		return text
	}
	return string([]rune(text)[:maxRunes]) + "…"
}

func parseLinkPreview(body io.Reader, pageURL *url.URL) linkPreview {
	meta := make(map[string]string)
	tokenizer := html.NewTokenizer(body)
	var title strings.Builder
	inTitle := false
	for {
		tokenType := tokenizer.Next()
		if tokenType == html.ErrorToken {
			break
		}
		token := tokenizer.Token()
		switch tokenType {
		case html.StartTagToken, html.SelfClosingTagToken:
			switch token.Data {
			case "title":
				inTitle = true
			case "meta":
				var key, value string
				for _, attr := range token.Attr {
					switch strings.ToLower(attr.Key) {
					case "name", "property":
						key = strings.ToLower(strings.TrimSpace(attr.Val))
					case "content":
						value = attr.Val
					}
				}
				if key != "" && value != "" && meta[key] == "" {
					meta[key] = value
				}
			}
		case html.TextToken:
			if inTitle && title.Len() < 1024 {
				title.WriteString(token.Data)
			}
		case html.EndTagToken:
			if token.Data == "title" {
				inTitle = false
			}
			if token.Data == "head" {
				goto done
			}
		}
	}
done:
	first := func(keys ...string) string {
		for _, key := range keys {
			if value := strings.TrimSpace(meta[key]); value != "" {
				return value
			}
		}
		return ""
	}
	image := ""
	if rawImage := first("og:image", "twitter:image", "twitter:image:src"); rawImage != "" {
		if candidate, err := url.Parse(strings.TrimSpace(rawImage)); err == nil {
			resolved := pageURL.ResolveReference(candidate)
			if validPreviewURL(resolved) {
				image = resolved.String()
			}
		}
	}
	pageTitle := first("og:title", "twitter:title", "title")
	if pageTitle == "" {
		pageTitle = title.String()
	}
	return linkPreview{
		Title:       clippedPreviewText(pageTitle, 180),
		Description: clippedPreviewText(first("og:description", "twitter:description", "description"), 360),
		Image:       image,
		SiteName:    clippedPreviewText(first("og:site_name"), 70),
	}
}

func (s *server) getLinkPreview(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("url"))
	if len(raw) == 0 || len(raw) > 2048 {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Đường dẫn không hợp lệ."})
		return
	}
	target, err := url.Parse(raw)
	if err != nil || !validPreviewURL(target) {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Chỉ hỗ trợ liên kết web công khai."})
		return
	}
	select {
	case linkPreviewSlots <- struct{}{}:
		defer func() { <-linkPreviewSlots }()
	default:
		httpx.JSON(w, http.StatusTooManyRequests, map[string]string{"error": "Tạm thời không tải được preview."})
		return
	}
	preview, err := fetchLinkPreview(r.Context(), target)
	if err != nil {
		// Unsupported pages remain ordinary clickable links in the chat.
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=300")
	httpx.JSON(w, http.StatusOK, preview)
}
