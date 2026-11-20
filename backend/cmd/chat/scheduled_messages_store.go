package main

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

const scheduledMessageLimit = 100

var (
	errScheduledForbidden = errors.New("scheduled messages are not allowed in this conversation")
	errScheduledEncrypted = errors.New("scheduling is not supported for encrypted conversations")
	errScheduledConflict  = errors.New("the scheduled-message client id was already used")
	errScheduledLimit     = errors.New("too many pending scheduled messages")
)

type scheduledMessage struct {
	ID        int64     `json:"id"`
	Text      *string   `json:"text,omitempty"`
	SendAt    time.Time `json:"sendAt"`
	ChannelID int64     `json:"channelId,omitempty"`
	State     string    `json:"state"`
	MessageID *int64    `json:"messageId,omitempty"`
}

const scheduledColumns = "id,body,send_at,COALESCE(channel_id,0),state,message_id"

func scanScheduled(row pgx.Row) (scheduledMessage, error) {
	var m scheduledMessage
	err := row.Scan(&m.ID, &m.Text, &m.SendAt, &m.ChannelID, &m.State, &m.MessageID)
	return m, err
}

// Lock the conversation before reading MLS state, as with the immediate send path.
func checkScheduledRoom(ctx context.Context, tx pgx.Tx, conversationID, userID, channelID int64) error {
	var roomType string
	err := tx.QueryRow(ctx, `SELECT c.type FROM conversations c
		JOIN conversation_members cm ON cm.conversation_id=c.id
		WHERE c.id=$1 AND cm.user_id=$2 FOR SHARE OF c, cm`, conversationID, userID).Scan(&roomType)
	if errors.Is(err, pgx.ErrNoRows) {
		return errScheduledForbidden
	}
	if err != nil {
		return err
	}
	var encrypted bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM e2ee_mls_groups WHERE conversation_id=$1 AND epoch>0
	)`, conversationID).Scan(&encrypted); err != nil {
		return err
	}
	if encrypted || (roomType == "direct" && mlsAutoDefaultEnabled()) {
		return errScheduledEncrypted
	}
	if channelID != 0 {
		var found int64
		err := tx.QueryRow(ctx, `SELECT id FROM group_channels WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL FOR SHARE`,
			channelID, conversationID).Scan(&found)
		if errors.Is(err, pgx.ErrNoRows) {
			return errScheduledForbidden
		}
		if err != nil {
			return err
		}
	}
	if roomType == "direct" {
		var blocked bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (
			SELECT 1 FROM conversation_members cm JOIN user_blocks b ON
			  (b.blocker_id=$2 AND b.blocked_id=cm.user_id) OR
			  (b.blocker_id=cm.user_id AND b.blocked_id=$2)
			WHERE cm.conversation_id=$1 AND cm.user_id<>$2
		)`, conversationID, userID).Scan(&blocked); err != nil {
			return err
		}
		if blocked {
			return errScheduledForbidden
		}
	}
	return nil
}

func (s *server) createScheduledMessage(ctx context.Context, conversationID, userID int64, input scheduleMessageInput) (scheduledMessage, error) {
	if err := input.normalize(); err != nil {
		return scheduledMessage{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return scheduledMessage{}, err
	}
	defer tx.Rollback(ctx)
	// Serialize new schedules per user so retries and the pending quota hold across replicas.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,
		"chatnet:scheduled-messages:"+strconv.FormatInt(userID, 10)); err != nil {
		return scheduledMessage{}, err
	}
	if err := checkScheduledRoom(ctx, tx, conversationID, userID, input.Channel); err != nil {
		return scheduledMessage{}, err
	}
	fingerprint := input.fingerprint(conversationID)
	var original string
	err = tx.QueryRow(ctx, `SELECT request_fingerprint FROM scheduled_messages
		WHERE user_id=$1 AND client_id=$2`, userID, input.ClientID).Scan(&original)
	if err == nil {
		if original != fingerprint {
			return scheduledMessage{}, errScheduledConflict
		}
		return scanScheduled(tx.QueryRow(ctx, "SELECT "+scheduledColumns+" FROM scheduled_messages WHERE user_id=$1 AND client_id=$2",
			userID, input.ClientID))
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return scheduledMessage{}, err
	}
	if _, err := scheduleTime(input.SendAt, time.Now()); err != nil {
		return scheduledMessage{}, err
	}
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM scheduled_messages WHERE user_id=$1 AND state='pending'`, userID).Scan(&count); err != nil {
		return scheduledMessage{}, err
	}
	if count >= scheduledMessageLimit {
		return scheduledMessage{}, errScheduledLimit
	}
	m, err := scanScheduled(tx.QueryRow(ctx, `INSERT INTO scheduled_messages
		(user_id,conversation_id,channel_id,client_id,request_fingerprint,body,send_at)
		VALUES ($1,$2,NULLIF($3,0),$4,$5,$6,$7) RETURNING `+scheduledColumns,
		userID, conversationID, input.Channel, input.ClientID, fingerprint, input.Text, input.SendAt))
	if err != nil {
		return scheduledMessage{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return scheduledMessage{}, err
	}
	return m, nil
}

func (s *server) cancelScheduledMessage(ctx context.Context, conversationID, userID, id int64) (scheduledMessage, error) {
	return scanScheduled(s.db.QueryRow(ctx, `UPDATE scheduled_messages SET state='cancelled',body=NULL
		WHERE id=$1 AND conversation_id=$2 AND user_id=$3 AND state IN ('pending','cancelled')
		RETURNING `+scheduledColumns, id, conversationID, userID))
}

func (s *server) rescheduleMessage(ctx context.Context, conversationID, userID, id int64, sendAt time.Time) (scheduledMessage, error) {
	at, err := scheduleTime(sendAt, time.Now())
	if err != nil {
		return scheduledMessage{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return scheduledMessage{}, err
	}
	defer tx.Rollback(ctx)
	var channelID int64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(channel_id,0) FROM scheduled_messages
		WHERE id=$1 AND conversation_id=$2 AND user_id=$3 AND state='pending'
		FOR UPDATE`, id, conversationID, userID).Scan(&channelID); err != nil {
		return scheduledMessage{}, err
	}
	if err := checkScheduledRoom(ctx, tx, conversationID, userID, channelID); err != nil {
		return scheduledMessage{}, err
	}
	m, err := scanScheduled(tx.QueryRow(ctx, "UPDATE scheduled_messages SET send_at=$2 WHERE id=$1 RETURNING "+scheduledColumns, id, at))
	if err != nil {
		return scheduledMessage{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return scheduledMessage{}, err
	}
	return m, nil
}

// dispatchScheduledMessage commits the message and queue transition in one transaction.
// An interrupted or retried transaction cannot send the same row twice.
func (s *server) dispatchScheduledMessage(ctx context.Context) (messageID, senderID int64, processed bool, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return 0, 0, false, err
	}
	defer tx.Rollback(ctx)
	var id, conversationID, channelID int64
	var text string
	err = tx.QueryRow(ctx, `SELECT id,conversation_id,user_id,COALESCE(channel_id,0),body
		FROM scheduled_messages WHERE state='pending' AND send_at <= NOW()
		ORDER BY send_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`).Scan(&id, &conversationID, &senderID, &channelID, &text)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	if err := checkScheduledRoom(ctx, tx, conversationID, senderID, channelID); err != nil {
		if !errors.Is(err, errScheduledForbidden) && !errors.Is(err, errScheduledEncrypted) {
			return 0, 0, false, err
		}
		if _, err := tx.Exec(ctx, "UPDATE scheduled_messages SET state='failed',body=NULL WHERE id=$1", id); err != nil {
			return 0, 0, false, err
		}
		err := tx.Commit(ctx)
		return 0, 0, err == nil, err
	}
	if err := tx.QueryRow(ctx, `INSERT INTO messages(conversation_id,user_id,text,channel_id)
		VALUES($1,$2,$3,NULLIF($4,0)) RETURNING id`, conversationID, senderID, text, channelID).Scan(&messageID); err != nil {
		return 0, 0, false, err
	}
	if _, err := tx.Exec(ctx, "UPDATE scheduled_messages SET state='sent',body=NULL,message_id=$2 WHERE id=$1", id, messageID); err != nil {
		return 0, 0, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, 0, false, err
	}
	return messageID, senderID, true, nil
}
