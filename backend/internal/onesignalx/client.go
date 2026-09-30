package onesignalx

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	appID  string
	apiKey string
	http   *http.Client
}

type Notification struct {
	Title string
	Body  string
	URL   string
	Data  map[string]any
}

func New(appID, apiKey string) *Client {
	return &Client{
		appID:  strings.TrimSpace(appID),
		apiKey: strings.TrimSpace(apiKey),
		http:   &http.Client{Timeout: 12 * time.Second},
	}
}

func (c *Client) Configured() bool {
	return c != nil && c.appID != "" && c.apiKey != ""
}

func (c *Client) AppID() string {
	if c == nil {
		return ""
	}
	return c.appID
}

func (c *Client) SendToSubscriptions(ctx context.Context, subscriptionIDs []string, n Notification) error {
	if !c.Configured() || len(subscriptionIDs) == 0 {
		return nil
	}

	ids := make([]string, 0, len(subscriptionIDs))
	seen := map[string]struct{}{}
	for _, id := range subscriptionIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil
	}

	payload := map[string]any{
		"app_id":                   c.appID,
		"target_channel":           "push",
		"include_subscription_ids": ids,
		"headings":                 map[string]string{"en": strings.TrimSpace(n.Title)},
		"contents":                 map[string]string{"en": strings.TrimSpace(n.Body)},
	}
	if strings.TrimSpace(n.URL) != "" {
		payload["url"] = n.URL
	}
	if len(n.Data) > 0 {
		payload["data"] = n.Data
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.onesignal.com/notifications", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Key "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("onesignal status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func Preview(text string, maxRunes int) string {
	text = strings.TrimSpace(text)
	runes := []rune(text)
	if len(runes) <= maxRunes {
		return text
	}
	return string(runes[:maxRunes]) + "…"
}
