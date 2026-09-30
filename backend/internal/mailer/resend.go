package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultAPIBaseURL = "https://api.resend.com"

type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

type resendMessage struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html,omitempty"`
	Text    string   `json:"text,omitempty"`
}

type Client struct {
	APIKey     string
	From       string
	APIBaseURL string
	HTTPClient *http.Client
}

func New(apiKey, from, baseURL string) (*Client, error) {
	apiKey = strings.TrimSpace(apiKey)
	from = strings.TrimSpace(from)
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if apiKey == "" {
		return nil, errors.New("RESEND_API_KEY is required")
	}
	if from == "" {
		return nil, errors.New("CHATNET_EMAIL_FROM is required")
	}
	if baseURL == "" {
		baseURL = defaultAPIBaseURL
	}
	return &Client{
		APIKey: apiKey, From: from, APIBaseURL: baseURL,
		HTTPClient: &http.Client{Timeout: 12 * time.Second},
	}, nil
}

func (c *Client) Send(ctx context.Context, message Message, idempotencyKey string) error {
	if c == nil {
		return errors.New("mailer is not configured")
	}
	if strings.TrimSpace(message.To) == "" || strings.TrimSpace(message.Subject) == "" {
		return errors.New("email recipient and subject are required")
	}

	payload, err := json.Marshal(resendMessage{
		From: c.From, To: []string{message.To}, Subject: message.Subject,
		HTML: message.HTML, Text: message.Text,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.APIBaseURL+"/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	if key := strings.TrimSpace(idempotencyKey); key != "" {
		req.Header.Set("Idempotency-Key", key)
	}

	client := c.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 12 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 32<<10))
		return nil
	}
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
	detail := strings.TrimSpace(string(raw))
	if detail == "" {
		detail = resp.Status
	}
	return fmt.Errorf("resend request failed (%d): %s", resp.StatusCode, detail)
}
