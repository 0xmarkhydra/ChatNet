package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

const maxScheduleLeadTime = 365 * 24 * time.Hour

var (
	errScheduledBody = errors.New("scheduled messages require text of 1 to 4000 bytes")
	errScheduledTime = errors.New("sendAt must be in the future and within 365 days")
	errScheduledID   = errors.New("invalid scheduled-message client id")
	errScheduledRoom = errors.New("invalid scheduled-message channel")
)

type scheduleMessageInput struct {
	Text     string    `json:"text"`
	SendAt   time.Time `json:"sendAt"`
	ClientID string    `json:"clientId"`
	Channel  int64     `json:"channelId,omitempty"`
}

func scheduleTime(sendAt, now time.Time) (time.Time, error) {
	// PostgreSQL stores timestamps at microsecond precision. Normalize before
	// testing boundaries or hashing so equivalent offsets get the same result.
	at := sendAt.UTC().Truncate(time.Microsecond)
	if !at.After(now) || at.After(now.Add(maxScheduleLeadTime)) {
		return time.Time{}, errScheduledTime
	}
	return at, nil
}

func (in *scheduleMessageInput) normalize() error {
	in.Text = strings.TrimSpace(in.Text)
	if in.Text == "" || len(in.Text) > 4000 || !utf8.ValidString(in.Text) || strings.ContainsRune(in.Text, 0) {
		return errScheduledBody
	}
	if in.ClientID == "" || !validClientID(in.ClientID) {
		return errScheduledID
	}
	if in.Channel < 0 {
		return errScheduledRoom
	}
	in.SendAt = in.SendAt.UTC().Truncate(time.Microsecond)
	return nil
}

func (in scheduleMessageInput) fingerprint(conversationID int64) string {
	data, _ := json.Marshal(struct {
		ConversationID int64
		Channel        int64
		Text           string
		SendAt         int64
	}{conversationID, in.Channel, in.Text, in.SendAt.UnixMicro()})
	return fmt.Sprintf("%x", sha256.Sum256(data))
}
