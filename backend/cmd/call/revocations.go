package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"
	"google.golang.org/protobuf/encoding/protowire"
)

const (
	callRevocationPollInterval           = 5 * time.Second
	callRevocationTokenWindow            = 11 * time.Minute
	callRevocationSafetyWindow           = time.Minute
	callRevocationScheduleDelayTolerance = 30 * time.Second
	callRevocationBatchSize              = 16
	maxCallRevocationAttempts            = 12
)

type liveKitRoomParticipantService interface {
	RemoveParticipant(context.Context, *livekit.RoomParticipantIdentity) (*livekit.RemoveParticipantResponse, error)
}

type callRevocation struct {
	ID                        int64
	Reason                    string
	ConversationID            int64
	CallID                    string
	ActorUserID               int64
	TargetUserID              int64
	Attempts                  int
	CreatedAt                 time.Time
	AvailableAt               time.Time
	RevocationWindowStartedAt pgtype.Timestamptz
}

type revocableCall struct {
	callSession
	ConversationType string
}

func (s *server) markParticipantLeftAndQueue(ctx context.Context, call callSession, userID int64, declined bool) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	result, err := tx.Exec(ctx, `
		UPDATE call_participants
		SET left_at=NOW(),
		    declined_at=CASE WHEN $3 THEN COALESCE(declined_at,NOW()) ELSE declined_at END
		WHERE call_id=$1 AND user_id=$2 AND left_at IS NULL`, call.ID, userID, declined)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return tx.Commit(ctx)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO call_revocations(reason,conversation_id,call_id,actor_user_id,target_user_id)
		VALUES('participant_left',$1,$2,$3,$3)
		ON CONFLICT DO NOTHING`, call.ConversationID, call.ID, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *server) ensureCallFinishedJob(ctx context.Context, call callSession) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO call_revocations(reason,conversation_id,call_id,actor_user_id,target_user_id)
		VALUES('call_finished',$1,$2,$3,$3)
		ON CONFLICT DO NOTHING`, call.ConversationID, call.ID, call.CreatedBy)
	return err
}

func (s *server) processCallRevocations(ctx context.Context) {
	ticker := time.NewTicker(callRevocationPollInterval)
	defer ticker.Stop()
	for {
		s.processPendingCallRevocation(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *server) processPendingCallRevocation(ctx context.Context) {
	s.logCallRevocationQueueStats(ctx)
	jobs, err := s.claimCallRevocations(ctx)
	if err != nil {
		log.Printf("claim call revocation failed code=%s", safeCallErrorCode(err))
		return
	}
	for _, job := range jobs {
		jobCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		affected, err := s.processCallRevocation(jobCtx, job)
		cancel()
		if err != nil {
			s.retryCallRevocation(ctx, job, err)
			continue
		}
		if affected && !s.liveKitConfigured() {
			s.retryCallRevocation(ctx, job, errors.New("livekit is not configured"))
			continue
		}
		if affected && (job.Reason == "block" || job.Reason == "member_removed") {
			now := time.Now()
			startedAt := callRevocationWindowStart(job, now)
			job.RevocationWindowStartedAt = pgtype.Timestamptz{Time: startedAt, Valid: true}
			if retryAt, wait := callRevocationPollAt(job, now); wait {
				s.deferCallRevocation(ctx, job, retryAt, startedAt)
				continue
			}
		}
		if _, err := s.db.Exec(ctx, `
			UPDATE call_revocations
			SET processed_at=NOW(),locked_until=NULL,last_error=NULL
			WHERE id=$1 AND processed_at IS NULL AND dead_lettered_at IS NULL`, job.ID); err != nil {
			log.Printf("complete call revocation failed id=%d code=%s", job.ID, safeCallErrorCode(err))
		}
	}
}

func (s *server) logCallRevocationQueueStats(ctx context.Context) {
	var depth int
	var oldest time.Time
	if err := s.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(MIN(available_at), NOW())
		FROM call_revocations
		WHERE processed_at IS NULL AND dead_lettered_at IS NULL`).Scan(&depth, &oldest); err != nil {
		log.Printf("call revocation queue stats failed code=%s", safeCallErrorCode(err))
		return
	}
	if depth == 0 {
		return
	}
	age := time.Since(oldest).Seconds()
	if age < 0 {
		age = 0
	}
	log.Printf("call revocation queue depth=%d oldest_age_seconds=%.0f", depth, age)
}

func (s *server) claimCallRevocations(ctx context.Context) ([]callRevocation, error) {
	rows, err := s.db.Query(ctx, fmt.Sprintf(`
		WITH pending AS (
			SELECT id FROM call_revocations
			WHERE processed_at IS NULL AND available_at <= NOW()
			  AND dead_lettered_at IS NULL
			  AND (locked_until IS NULL OR locked_until <= NOW())
			ORDER BY available_at, id
			LIMIT %d
			FOR UPDATE SKIP LOCKED
		)
		UPDATE call_revocations r
			SET locked_until=NOW()+INTERVAL '10 minutes'
		FROM pending
		WHERE r.id=pending.id
		RETURNING r.id,r.reason,COALESCE(r.conversation_id,0),COALESCE(r.call_id,''),r.actor_user_id,
		          r.target_user_id,r.attempts,r.created_at,r.available_at,
		          r.revocation_window_started_at`, callRevocationBatchSize))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	jobs := make([]callRevocation, 0, callRevocationBatchSize)
	for rows.Next() {
		var job callRevocation
		if err := rows.Scan(&job.ID, &job.Reason, &job.ConversationID, &job.CallID, &job.ActorUserID,
			&job.TargetUserID, &job.Attempts, &job.CreatedAt, &job.AvailableAt,
			&job.RevocationWindowStartedAt); err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (s *server) retryCallRevocation(ctx context.Context, job callRevocation, cause error) {
	availableAt := time.Now().Add(callRevocationRetryDelay(job.Attempts))
	code := safeCallErrorCode(cause)
	if job.Attempts+1 >= maxCallRevocationAttempts && shouldDeadLetterCallRevocation(job.Reason) {
		if _, err := s.db.Exec(ctx, `
			UPDATE call_revocations
			SET locked_until=NULL,last_error=$2,attempts=attempts+1,dead_lettered_at=NOW()
			WHERE id=$1 AND processed_at IS NULL AND dead_lettered_at IS NULL`, job.ID, code); err != nil {
			log.Printf("dead-letter call revocation failed id=%d code=%s", job.ID, safeCallErrorCode(err))
			return
		}
		log.Printf("call revocation dead-lettered id=%d reason=%s target=%d attempts=%d code=%s", job.ID, job.Reason, job.TargetUserID, job.Attempts+1, code)
		return
	}
	if _, err := s.db.Exec(ctx, `
		UPDATE call_revocations
		SET locked_until=NULL,available_at=$2,last_error=$3,attempts=attempts+1,
		    revocation_window_started_at=NULL
		WHERE id=$1 AND processed_at IS NULL AND dead_lettered_at IS NULL`, job.ID, availableAt, code); err != nil {
		log.Printf("schedule call revocation retry failed id=%d code=%s", job.ID, safeCallErrorCode(err))
	}
	log.Printf("call revocation failed id=%d reason=%s target=%d code=%s", job.ID, job.Reason, job.TargetUserID, code)
}

func callRevocationRetryDelay(attempts int) time.Duration {
	shift := attempts - 1
	if shift < 0 {
		shift = 0
	}
	if shift > 8 {
		shift = 8
	}
	return time.Duration(1<<shift) * time.Second
}

func shouldDeadLetterCallRevocation(reason string) bool {
	// Valid revocation jobs retry forever; dropping one can leave media active.
	// Dead-letter only malformed reasons, which the database check normally rejects.
	switch reason {
	case "block", "member_removed", "participant_left", "call_finished":
		return false
	default:
		return true
	}
}

func (s *server) deferCallRevocation(ctx context.Context, job callRevocation, retryAt, startedAt time.Time) {
	if _, err := s.db.Exec(ctx, `
		UPDATE call_revocations
		SET locked_until=NULL,available_at=$2,last_error=NULL,revocation_window_started_at=$3
		WHERE id=$1 AND processed_at IS NULL AND dead_lettered_at IS NULL`, job.ID, retryAt, startedAt); err != nil {
		log.Printf("defer call revocation failed id=%d code=%s", job.ID, safeCallErrorCode(err))
	}
}

func callRevocationPollAt(job callRevocation, now time.Time) (time.Time, bool) {
	startedAt := callRevocationWindowStart(job, now)
	safeAt := startedAt.Add(callRevocationTokenWindow + callRevocationSafetyWindow)
	if !now.Before(safeAt) {
		return time.Time{}, false
	}
	next := now.Add(callRevocationPollInterval)
	if next.After(safeAt) {
		next = safeAt
	}
	return next, true
}

func callRevocationWindowStart(job callRevocation, now time.Time) time.Time {
	if !job.RevocationWindowStartedAt.Valid || now.Sub(job.AvailableAt) > callRevocationScheduleDelayTolerance {
		return now
	}
	return job.RevocationWindowStartedAt.Time
}

func (s *server) processCallRevocation(ctx context.Context, job callRevocation) (bool, error) {
	switch job.Reason {
	case "block":
		return s.revokeBlockedParticipant(ctx, job)
	case "member_removed":
		return s.revokeRemovedMember(ctx, job)
	case "participant_left":
		return s.revokeLeftParticipant(ctx, job)
	case "call_finished":
		return s.cleanupFinishedCall(ctx, job)
	default:
		return false, fmt.Errorf("unknown call revocation reason %q", job.Reason)
	}
}

func (s *server) revokeBlockedParticipant(ctx context.Context, job callRevocation) (bool, error) {
	rows, err := s.db.Query(ctx, `
		SELECT cs.id,cs.conversation_id,cs.created_by,cs.media_type,cs.status,cs.livekit_room,
		       cs.created_at,cs.started_at,cs.ended_at,c.type
		FROM call_sessions cs
		JOIN conversations c ON c.id=cs.conversation_id
		JOIN call_participants blocker ON blocker.call_id=cs.id AND blocker.user_id=$1
		JOIN call_participants blocked ON blocked.call_id=cs.id AND blocked.user_id=$2
		WHERE cs.created_at <= $3 AND (cs.status IN ('ringing','active')
		       OR (cs.status IN ('ended','cancelled') AND cs.ended_at >= $3))`,
		job.ActorUserID, job.TargetUserID, job.CreatedAt)
	if err != nil {
		return false, err
	}
	calls := make([]revocableCall, 0)
	for rows.Next() {
		var call revocableCall
		if err := rows.Scan(&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType,
			&call.Status, &call.RoomName, &call.CreatedAt, &call.StartedAt, &call.EndedAt,
			&call.ConversationType); err != nil {
			rows.Close()
			return false, err
		}
		calls = append(calls, call)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return false, err
	}
	rows.Close()

	for _, call := range calls {
		if call.ConversationType == "direct" {
			if call.Status == "ringing" || call.Status == "active" {
				if err := s.revokeCallParticipant(ctx, call.callSession, job.TargetUserID); err != nil {
					return false, err
				}
				if err := s.finishCall(ctx, &call.callSession, "ended"); err != nil {
					return false, err
				}
				s.afterCallFinished(call.callSession)
			} else if err := s.revokeCallParticipant(ctx, call.callSession, job.TargetUserID); err != nil {
				return false, err
			} else if err := s.ensureCallFinishedJob(ctx, call.callSession); err != nil {
				return false, err
			}
			continue
		}
		if call.Status == "ended" || call.Status == "cancelled" {
			if err := s.ensureCallFinishedJob(ctx, call.callSession); err != nil {
				return false, err
			}
			if err := s.revokeCallParticipant(ctx, call.callSession, job.TargetUserID); err != nil {
				return false, err
			}
			continue
		}
		if err := s.revokeCallParticipant(ctx, call.callSession, job.TargetUserID); err != nil {
			return false, err
		}
	}
	return len(calls) > 0, nil
}

func (s *server) revokeRemovedMember(ctx context.Context, job callRevocation) (bool, error) {
	rows, err := s.db.Query(ctx, `
		SELECT cs.id,cs.conversation_id,cs.created_by,cs.media_type,cs.status,cs.livekit_room,
		       cs.created_at,cs.started_at,cs.ended_at
		FROM call_sessions cs
		JOIN call_participants p ON p.call_id=cs.id AND p.user_id=$2
		WHERE cs.conversation_id=$1 AND cs.created_at <= $3 AND (
			cs.status IN ('ringing','active')
			OR (cs.status IN ('ended','cancelled') AND cs.ended_at >= $3)
		)`, job.ConversationID, job.TargetUserID, job.CreatedAt)
	if err != nil {
		return false, err
	}
	calls := make([]callSession, 0)
	for rows.Next() {
		var call callSession
		if err := rows.Scan(&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType,
			&call.Status, &call.RoomName, &call.CreatedAt, &call.StartedAt, &call.EndedAt); err != nil {
			rows.Close()
			return false, err
		}
		calls = append(calls, call)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return false, err
	}
	rows.Close()

	for _, call := range calls {
		if call.Status == "ended" || call.Status == "cancelled" {
			if err := s.ensureCallFinishedJob(ctx, call); err != nil {
				return false, err
			}
			if err := s.revokeCallParticipant(ctx, call, job.TargetUserID); err != nil {
				return false, err
			}
			continue
		}
		if err := s.revokeCallParticipant(ctx, call, job.TargetUserID); err != nil {
			return false, err
		}
	}
	return len(calls) > 0, nil
}

func (s *server) revokeLeftParticipant(ctx context.Context, job callRevocation) (bool, error) {
	var call callSession
	if err := s.db.QueryRow(ctx, `
		SELECT cs.id,cs.conversation_id,cs.created_by,cs.media_type,cs.status,cs.livekit_room,
		       cs.created_at,cs.started_at,cs.ended_at
		FROM call_sessions cs
		JOIN call_participants p ON p.call_id=cs.id AND p.user_id=$2 AND p.left_at IS NOT NULL
		WHERE cs.id=$1`, job.CallID, job.TargetUserID).Scan(
		&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType, &call.Status,
		&call.RoomName, &call.CreatedAt, &call.StartedAt, &call.EndedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if err := s.revokeCallParticipant(ctx, call, job.TargetUserID); err != nil {
		return false, err
	}
	return true, nil
}

func (s *server) cleanupFinishedCall(ctx context.Context, job callRevocation) (bool, error) {
	var call callSession
	if err := s.db.QueryRow(ctx, `
		SELECT id,conversation_id,created_by,media_type,status,livekit_room,
		       created_at,started_at,ended_at
		FROM call_sessions WHERE id=$1`, job.CallID).Scan(
		&call.ID, &call.ConversationID, &call.CreatedBy, &call.MediaType, &call.Status,
		&call.RoomName, &call.CreatedAt, &call.StartedAt, &call.EndedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	rows, err := s.db.Query(ctx, `SELECT user_id FROM call_participants WHERE call_id=$1 ORDER BY user_id`, call.ID)
	if err != nil {
		return false, err
	}
	users := make([]int64, 0)
	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			rows.Close()
			return false, err
		}
		users = append(users, userID)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return false, err
	}
	rows.Close()
	for _, userID := range users {
		if err := s.revokeCallParticipant(ctx, call, userID); err != nil {
			return false, err
		}
	}
	if err := s.deleteLiveKitRoom(ctx, call.RoomName); err != nil {
		return false, err
	}
	return true, nil
}

func (s *server) revokeCallParticipant(ctx context.Context, call callSession, userID int64) error {
	kickCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := s.removeLiveKitParticipantAt(kickCtx, call.RoomName, userID); err != nil {
		return err
	}
	if err := s.cleanupCallCrypto(ctx, call.ID, []int64{userID}); err != nil {
		return err
	}
	if err := s.revokeCallTranslationConsent(ctx, call.ID, userID); err != nil {
		return err
	}
	tag, err := s.db.Exec(ctx, `
		UPDATE call_participants SET left_at=COALESCE(left_at,NOW())
		WHERE call_id=$1 AND user_id=$2 AND left_at IS NULL`, call.ID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		s.publishCallEvent(ctx, s.callUserIDs(ctx, call.ID), "call.updated", call)
	}
	return nil
}

func revokeParticipantBeforeRoomDelete(ctx context.Context, call callSession, userID int64,
	revoke func(context.Context, callSession, int64) error,
	deleteRoom func(context.Context, string) error,
) error {
	if err := revoke(ctx, call, userID); err != nil {
		return err
	}
	return deleteRoom(ctx, call.RoomName)
}

func removeLiveKitParticipantAndRevoke(ctx context.Context, service liveKitRoomParticipantService, roomName string, userID int64) error {
	request := &livekit.RoomParticipantIdentity{
		Room:     roomName,
		Identity: participantIdentity(userID),
	}
	// The pinned protocol package lacks the generated field; encode wire field 3 for token revocation.
	unknown := protowire.AppendTag(nil, 3, protowire.VarintType)
	unknown = protowire.AppendVarint(unknown, uint64(time.Now().Unix()))
	request.ProtoReflect().SetUnknown(unknown)
	_, err := service.RemoveParticipant(ctx, request)
	if err != nil && !isTwirpNotFound(err) {
		return err
	}
	return nil
}

func isTwirpNotFound(err error) bool {
	var rpcErr twirp.Error
	return errors.As(err, &rpcErr) && rpcErr.Code() == twirp.NotFound
}

func safeCallErrorCode(err error) string {
	if err == nil {
		return "unknown"
	}
	var rpcErr twirp.Error
	if errors.As(err, &rpcErr) {
		return string(rpcErr.Code())
	}
	var postgresErr *pgconn.PgError
	if errors.As(err, &postgresErr) {
		return postgresErr.Code
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "deadline_exceeded"
	}
	if errors.Is(err, context.Canceled) {
		return "canceled"
	}
	var networkErr net.Error
	if errors.As(err, &networkErr) {
		return "network_error"
	}
	return "internal"
}
