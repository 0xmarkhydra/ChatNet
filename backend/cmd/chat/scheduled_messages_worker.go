package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"chatnet/internal/onesignalx"
)

func (s *server) runScheduledMessages(ctx context.Context) {
	tick := time.NewTicker(2 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			s.drainScheduledMessages(ctx)
		}
	}
}

func (s *server) drainScheduledMessages(ctx context.Context) {
	for range 32 {
		jobCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		messageID, senderID, processed, err := s.dispatchScheduledMessage(jobCtx)
		cancel()
		if err != nil {
			log.Printf("cannot process scheduled message: %T", err)
			return
		}
		if !processed {
			return
		}
		if messageID != 0 {
			notifyCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			s.notifyScheduledMessage(notifyCtx, messageID, senderID)
			cancel()
		}
	}
}

func (s *server) notifyScheduledMessage(ctx context.Context, messageID, senderID int64) {
	m, err := s.loadMessage(ctx, messageID, senderID)
	if err != nil {
		log.Printf("cannot load delivered scheduled message %d: %T", messageID, err)
		return
	}
	visible, err := s.visibleRecipients(ctx, senderID, s.memberIDs(ctx, m.ConversationID))
	if err != nil {
		log.Printf("cannot resolve scheduled message recipients %d: %T", messageID, err)
		return
	}
	s.publishConversationEvent(ctx, visible, realtimeEvent{Type: "message", ConversationID: m.ConversationID, Message: &m})
	recipients := make([]int64, 0, len(visible))
	for _, id := range visible {
		if id != senderID {
			recipients = append(recipients, id)
		}
	}
	recipients = s.groupPushRecipients(ctx, m.ConversationID, m.ChannelID, recipients, m.Text)
	s.sendPushAsync(recipients, onesignalx.Notification{
		Title: "ChatNet",
		Body:  "Bạn có một tin nhắn mới.",
		URL:   fmt.Sprintf("https://chat.codelocal.cloud/?conversation=%d&message=%d", m.ConversationID, m.ID),
		Data:  map[string]any{"type": "message", "conversationId": m.ConversationID, "messageId": m.ID},
	})
}
