package main

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"chatnet/internal/database"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/livekit/protocol/livekit"
	"github.com/redis/go-redis/v9"
	"github.com/twitchtv/twirp"
	"google.golang.org/protobuf/encoding/protowire"
)

type fakeLiveKitRoomParticipantService struct {
	removeErr   error
	removeReq   *livekit.RoomParticipantIdentity
	removeCalls int
}

func (f *fakeLiveKitRoomParticipantService) RemoveParticipant(_ context.Context, req *livekit.RoomParticipantIdentity) (*livekit.RemoveParticipantResponse, error) {
	f.removeReq = req
	f.removeCalls++
	return nil, f.removeErr
}

func TestAbsentLiveKitParticipantStillGetsRevokeRequestAndJobStaysPending(t *testing.T) {
	const roomName = "room-test"
	const userID int64 = 42
	service := &fakeLiveKitRoomParticipantService{
		removeErr: twirp.NewError(twirp.NotFound, "participant does not exist"),
	}

	if err := removeLiveKitParticipantAndRevoke(context.Background(), service, roomName, userID); err != nil {
		t.Fatalf("remove absent participant: %v", err)
	}
	if service.removeCalls != 1 || service.removeReq == nil {
		t.Fatalf("RemoveParticipant calls=%d request=%+v, want one call for absent participant", service.removeCalls, service.removeReq)
	}
	if service.removeReq.Room != roomName || service.removeReq.Identity != participantIdentity(userID) {
		t.Fatalf("RemoveParticipant request=%+v, want room=%q identity=%q", service.removeReq, roomName, participantIdentity(userID))
	}
	field, kind, n := protowire.ConsumeTag(service.removeReq.ProtoReflect().GetUnknown())
	if n < 0 || field != 3 || kind != protowire.VarintType {
		t.Fatalf("RemoveParticipant request missing revoke timestamp: field=%d kind=%v bytes=%x", field, kind, service.removeReq.ProtoReflect().GetUnknown())
	}
	value, n := protowire.ConsumeVarint(service.removeReq.ProtoReflect().GetUnknown()[n:])
	if n < 0 || value == 0 || value > uint64(time.Now().Unix()) {
		t.Fatalf("RemoveParticipant revoke timestamp=%d, want current Unix timestamp", value)
	}
	startedAt := time.Now()
	job := callRevocation{
		CreatedAt:                 startedAt.Add(-30 * time.Minute),
		AvailableAt:               startedAt,
		RevocationWindowStartedAt: pgtype.Timestamptz{Time: startedAt, Valid: true},
	}
	beforeExpiry := startedAt.Add(callRevocationTokenWindow)
	job.AvailableAt = beforeExpiry.Add(-callRevocationPollInterval)
	if _, pending := callRevocationPollAt(job, beforeExpiry); !pending {
		t.Fatal("revocation job completed before token safety window")
	}
	expiredAt := startedAt.Add(callRevocationTokenWindow + callRevocationSafetyWindow)
	job.AvailableAt = expiredAt.Add(-callRevocationPollInterval)
	if _, pending := callRevocationPollAt(job, expiredAt); pending {
		t.Fatal("revocation job stayed pending after token safety window")
	}
}

func TestDelayedCallRevocationRestartsTokenSafetyWindow(t *testing.T) {
	now := time.Now()
	job := callRevocation{
		AvailableAt: now.Add(-time.Minute),
		RevocationWindowStartedAt: pgtype.Timestamptz{
			Time: now.Add(-callRevocationTokenWindow - callRevocationSafetyWindow), Valid: true,
		},
	}

	startedAt := callRevocationWindowStart(job, now)
	if !startedAt.Equal(now) {
		t.Fatalf("window started at %s, want delayed processing time %s", startedAt, now)
	}
	job.RevocationWindowStartedAt = pgtype.Timestamptz{Time: startedAt, Valid: true}
	if _, pending := callRevocationPollAt(job, now); !pending {
		t.Fatal("delayed revoke job completed before fresh token safety window")
	}
}

func TestCallRevocationRetryPolicyKeepsRevokeJobsRetrying(t *testing.T) {
	for _, reason := range []string{"block", "member_removed", "participant_left", "call_finished"} {
		if shouldDeadLetterCallRevocation(reason) {
			t.Fatalf("reason=%q must retry forever", reason)
		}
	}
	if !shouldDeadLetterCallRevocation("unknown") {
		t.Fatal("unknown reason must remain dead-letterable")
	}
	if got := callRevocationRetryDelay(1); got != time.Second {
		t.Fatalf("attempt 1 delay=%s, want 1s", got)
	}
	if got := callRevocationRetryDelay(9); got != 256*time.Second {
		t.Fatalf("attempt 9 delay=%s, want 256s cap", got)
	}
	if got := callRevocationRetryDelay(99); got != 256*time.Second {
		t.Fatalf("attempt 99 delay=%s, want 256s cap", got)
	}
}

func TestEndedGroupCallRevokesTargetBeforeRoomDelete(t *testing.T) {
	call := callSession{ID: "call-1", RoomName: "room-1"}
	const targetUserID int64 = 42
	steps := make([]string, 0, 2)
	err := revokeParticipantBeforeRoomDelete(context.Background(), call, targetUserID,
		func(_ context.Context, got callSession, userID int64) error {
			if got.ID != call.ID || userID != targetUserID {
				t.Fatalf("revoke call=%q user=%d, want call=%q user=%d", got.ID, userID, call.ID, targetUserID)
			}
			steps = append(steps, "revoke")
			return nil
		},
		func(_ context.Context, roomName string) error {
			if roomName != call.RoomName {
				t.Fatalf("delete room=%q, want %q", roomName, call.RoomName)
			}
			steps = append(steps, "delete")
			return nil
		})
	if err != nil {
		t.Fatal(err)
	}
	if len(steps) != 2 || steps[0] != "revoke" || steps[1] != "delete" {
		t.Fatalf("steps=%v, want [revoke delete]", steps)
	}
}

func TestEndedGroupCallKeepsRoomWhenRevokeFails(t *testing.T) {
	revokeErr := fmt.Errorf("revoke failed")
	deleted := false
	err := revokeParticipantBeforeRoomDelete(context.Background(), callSession{RoomName: "room-1"}, 42,
		func(context.Context, callSession, int64) error { return revokeErr },
		func(context.Context, string) error {
			deleted = true
			return nil
		})
	if err != revokeErr {
		t.Fatalf("error=%v, want revoke error", err)
	}
	if deleted {
		t.Fatal("room deleted before participant revoke succeeded")
	}
}

func TestProcessCallRevocationsIntegration(t *testing.T) {
	databaseURL := os.Getenv("CHATNET_TEST_DATABASE_URL")
	redisAddr := os.Getenv("CHATNET_TEST_REDIS_ADDR")
	if databaseURL == "" || redisAddr == "" {
		t.Skip("isolated PostgreSQL and Redis required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	resetCallRevocationQueue(t, ctx, db)
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("isolated Redis unavailable: %v", err)
	}
	s := &server{db: db, redis: rdb}

	ids := [3]int64{}
	for i := range ids {
		username := fmt.Sprintf("call_revoke_%d_%d", time.Now().UnixNano(), i)
		if err := db.QueryRow(ctx, `INSERT INTO users(email,username,password_hash,display_name)
			VALUES($1,$2,'!',$2) RETURNING id`, username+"@example.invalid", username).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), "DELETE FROM users WHERE id=$1", ids[i])
	}
	var directID, groupID int64
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,direct_key,created_by)
		VALUES('direct',$1,$2) RETURNING id`, fmt.Sprintf("%d:%d", min(ids[0], ids[1]), max(ids[0], ids[1])), ids[0]).Scan(&directID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO conversations(type,name,created_by)
		VALUES('group','revoke test',$1) RETURNING id`, ids[2]).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	for _, id := range ids[:2] {
		if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role)
			VALUES($1,$2,'member')`, directID, id); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id,role)
		VALUES($1,$2,'owner'),($1,$3,'member')`, groupID, ids[2], ids[1]); err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	directCallID := fmt.Sprintf("call_revoke_d_%d", now.UnixNano())
	directRoom := fmt.Sprintf("room_revoke_d_%d", now.UnixNano())
	if _, err := db.Exec(ctx, `INSERT INTO call_sessions(id,conversation_id,created_by,media_type,status,livekit_room,started_at)
		VALUES($1,$2,$3,'audio','active',$4,$5)`, directCallID, directID, ids[0], directRoom, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO call_participants(call_id,user_id,role,joined_at)
		VALUES($1,$2,'host',$3),($1,$4,'participant',$3)`, directCallID, ids[0], now, ids[1]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, ids[0], ids[1]); err != nil {
		t.Fatal(err)
	}
	var blockJob callRevocation
	blockJob.Reason = "block"
	blockJob.ActorUserID = ids[0]
	blockJob.TargetUserID = ids[1]
	if err := db.QueryRow(ctx, `INSERT INTO call_revocations(reason,actor_user_id,target_user_id)
		VALUES('block',$1,$2) RETURNING id,created_at`, ids[0], ids[1]).Scan(&blockJob.ID, &blockJob.CreatedAt); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM call_revocations WHERE id=$1", blockJob.ID)
	for key, value := range map[string]string{
		publicKeyRedisKey(directCallID, ids[0]):     "direct-key",
		envelopeRedisKey(directCallID, ids[1]):      "direct-envelope",
		translationConsentKey(directCallID, ids[0]): "true",
	} {
		if err := rdb.Set(ctx, key, value, 0).Err(); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.processCallRevocation(ctx, blockJob); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "UPDATE call_revocations SET processed_at=NOW() WHERE id=$1", blockJob.ID); err != nil {
		t.Fatal(err)
	}
	drainCallFinishedJob(t, ctx, db, s, directCallID)
	var status string
	if err := db.QueryRow(ctx, "SELECT status FROM call_sessions WHERE id=$1", directCallID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "ended" {
		t.Fatalf("blocked direct call status=%q, want ended", status)
	}
	var directParticipantsLeft int
	if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM call_participants WHERE call_id=$1 AND left_at IS NOT NULL", directCallID).Scan(&directParticipantsLeft); err != nil {
		t.Fatal(err)
	}
	if directParticipantsLeft != 2 {
		t.Fatalf("blocked direct call left participants=%d, want 2", directParticipantsLeft)
	}
	var processed bool
	if err := db.QueryRow(ctx, "SELECT processed_at IS NOT NULL FROM call_revocations WHERE id=$1", blockJob.ID).Scan(&processed); err != nil {
		t.Fatal(err)
	}
	if !processed {
		t.Fatal("block revocation was not marked processed")
	}
	for _, key := range []string{
		publicKeyRedisKey(directCallID, ids[0]),
		envelopeRedisKey(directCallID, ids[1]),
		translationConsentKey(directCallID, ids[0]),
	} {
		if exists, err := rdb.Exists(ctx, key).Result(); err != nil || exists != 0 {
			t.Fatalf("direct call state key %q remains: exists=%d err=%v", key, exists, err)
		}
	}

	groupCallID := fmt.Sprintf("call_revoke_g_%d", now.UnixNano())
	groupRoom := fmt.Sprintf("room_revoke_g_%d", now.UnixNano())
	if _, err := db.Exec(ctx, `INSERT INTO call_sessions(id,conversation_id,created_by,media_type,status,livekit_room,started_at)
		VALUES($1,$2,$3,'audio','active',$4,$5)`, groupCallID, groupID, ids[2], groupRoom, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO call_participants(call_id,user_id,role,joined_at)
		VALUES($1,$2,'host',$3),($1,$4,'participant',$3)`, groupCallID, ids[2], now, ids[1]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, ids[2], ids[1]); err != nil {
		t.Fatal(err)
	}
	var groupBlockJob callRevocation
	groupBlockJob.Reason = "block"
	groupBlockJob.ActorUserID = ids[2]
	groupBlockJob.TargetUserID = ids[1]
	if err := db.QueryRow(ctx, `INSERT INTO call_revocations(reason,actor_user_id,target_user_id)
		VALUES('block',$1,$2) RETURNING id,created_at`, ids[2], ids[1]).Scan(&groupBlockJob.ID, &groupBlockJob.CreatedAt); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM call_revocations WHERE id=$1", groupBlockJob.ID)
	for key, value := range map[string]string{
		publicKeyRedisKey(groupCallID, ids[1]):     "group-block-key",
		envelopeRedisKey(groupCallID, ids[1]):      "group-block-envelope",
		translationConsentKey(groupCallID, ids[1]): "true",
	} {
		if err := rdb.Set(ctx, key, value, 0).Err(); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.processCallRevocation(ctx, groupBlockJob); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "UPDATE call_revocations SET processed_at=NOW() WHERE id=$1", groupBlockJob.ID); err != nil {
		t.Fatal(err)
	}
	var groupBlockTargetLeft, groupBlockActorLeft bool
	if err := db.QueryRow(ctx, `SELECT target.left_at IS NOT NULL,actor.left_at IS NOT NULL
		FROM call_participants target
		JOIN call_participants actor ON actor.call_id=target.call_id
		WHERE target.call_id=$1 AND target.user_id=$2 AND actor.user_id=$3`, groupCallID, ids[1], ids[2]).Scan(&groupBlockTargetLeft, &groupBlockActorLeft); err != nil {
		t.Fatal(err)
	}
	if !groupBlockTargetLeft || groupBlockActorLeft {
		t.Fatalf("blocked group call targetLeft=%t actorLeft=%t, want true/false", groupBlockTargetLeft, groupBlockActorLeft)
	}
	for _, key := range []string{
		publicKeyRedisKey(groupCallID, ids[1]),
		envelopeRedisKey(groupCallID, ids[1]),
		translationConsentKey(groupCallID, ids[1]),
	} {
		if exists, err := rdb.Exists(ctx, key).Result(); err != nil || exists != 0 {
			t.Fatalf("blocked group call state key %q remains: exists=%d err=%v", key, exists, err)
		}
	}
	if _, err := db.Exec(ctx, "DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", ids[2], ids[1]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "UPDATE call_participants SET left_at=NULL WHERE call_id=$1 AND user_id=$2", groupCallID, ids[1]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2", groupID, ids[1]); err != nil {
		t.Fatal(err)
	}
	var memberJob callRevocation
	memberJob.Reason = "member_removed"
	memberJob.ConversationID = groupID
	memberJob.ActorUserID = ids[2]
	memberJob.TargetUserID = ids[1]
	if err := db.QueryRow(ctx, `INSERT INTO call_revocations(reason,conversation_id,actor_user_id,target_user_id)
		VALUES('member_removed',$1,$2,$3) RETURNING id,created_at`, groupID, ids[2], ids[1]).Scan(&memberJob.ID, &memberJob.CreatedAt); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), "DELETE FROM call_revocations WHERE id=$1", memberJob.ID)
	for key, value := range map[string]string{
		publicKeyRedisKey(groupCallID, ids[1]):     "group-key",
		envelopeRedisKey(groupCallID, ids[1]):      "group-envelope",
		translationConsentKey(groupCallID, ids[1]): "true",
	} {
		if err := rdb.Set(ctx, key, value, 0).Err(); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.processCallRevocation(ctx, memberJob); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, "UPDATE call_revocations SET processed_at=NOW() WHERE id=$1", memberJob.ID); err != nil {
		t.Fatal(err)
	}
	var targetLeft, actorLeft bool
	if err := db.QueryRow(ctx, `SELECT target.left_at IS NOT NULL,actor.left_at IS NOT NULL
		FROM call_participants target
		JOIN call_participants actor ON actor.call_id=target.call_id
		WHERE target.call_id=$1 AND target.user_id=$2 AND actor.user_id=$3`, groupCallID, ids[1], ids[2]).Scan(&targetLeft, &actorLeft); err != nil {
		t.Fatal(err)
	}
	if !targetLeft || actorLeft {
		t.Fatalf("group revocation targetLeft=%t actorLeft=%t, want true/false", targetLeft, actorLeft)
	}
	if err := db.QueryRow(ctx, "SELECT processed_at IS NOT NULL FROM call_revocations WHERE id=$1", memberJob.ID).Scan(&processed); err != nil {
		t.Fatal(err)
	}
	if !processed {
		t.Fatal("membership revocation was not marked processed")
	}
	for _, key := range []string{
		publicKeyRedisKey(groupCallID, ids[1]),
		envelopeRedisKey(groupCallID, ids[1]),
		translationConsentKey(groupCallID, ids[1]),
	} {
		if exists, err := rdb.Exists(ctx, key).Result(); err != nil || exists != 0 {
			t.Fatalf("group call state key %q remains: exists=%d err=%v", key, exists, err)
		}
	}
}

func TestClaimCallRevocationsPrioritizesLongestWaitingJob(t *testing.T) {
	databaseURL := os.Getenv("CHATNET_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("isolated PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	resetCallRevocationQueue(t, ctx, db)

	var oldestID, middleID, newestID int64
	if err := db.QueryRow(ctx, `INSERT INTO call_revocations(reason,actor_user_id,target_user_id,available_at)
		VALUES('block',1,2,NOW()-INTERVAL '30 seconds') RETURNING id`).Scan(&oldestID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO call_revocations(reason,actor_user_id,target_user_id,available_at)
		VALUES('block',3,4,NOW()-INTERVAL '20 seconds') RETURNING id`).Scan(&middleID); err != nil {
		_, _ = db.Exec(context.Background(), "DELETE FROM call_revocations WHERE id=$1", oldestID)
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO call_revocations(reason,actor_user_id,target_user_id,available_at)
		VALUES('block',5,6,NOW()-INTERVAL '10 seconds') RETURNING id`).Scan(&newestID); err != nil {
		_, _ = db.Exec(context.Background(), "DELETE FROM call_revocations WHERE id IN ($1,$2)", oldestID, middleID)
		t.Fatal(err)
	}
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()
		if _, err := db.Exec(cleanupCtx, "DELETE FROM call_revocations WHERE id IN ($1,$2,$3)", oldestID, middleID, newestID); err != nil {
			t.Errorf("clean up test jobs: %v", err)
		}
	}()

	jobs, err := (&server{db: db}).claimCallRevocations(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 3 || jobs[0].ID != oldestID || jobs[1].ID != middleID || jobs[2].ID != newestID {
		t.Fatalf("claimed jobs=%v, want batch order [%d %d %d]", jobs, oldestID, middleID, newestID)
	}
}

func resetCallRevocationQueue(t *testing.T, ctx context.Context, db *pgxpool.Pool) {
	t.Helper()
	if _, err := db.Exec(ctx, "DELETE FROM call_revocations"); err != nil {
		t.Fatalf("reset call revocation queue: %v", err)
	}
}

func drainCallFinishedJob(t *testing.T, ctx context.Context, db *pgxpool.Pool, s *server, callID string) {
	t.Helper()
	var job callRevocation
	err := db.QueryRow(ctx, `
		SELECT id,reason,COALESCE(conversation_id,0),COALESCE(call_id,''),actor_user_id,
		       target_user_id,attempts,created_at,available_at,revocation_window_started_at
		FROM call_revocations
		WHERE call_id=$1 AND reason='call_finished' AND processed_at IS NULL
		ORDER BY id DESC LIMIT 1`, callID).Scan(
		&job.ID, &job.Reason, &job.ConversationID, &job.CallID, &job.ActorUserID,
		&job.TargetUserID, &job.Attempts, &job.CreatedAt, &job.AvailableAt,
		&job.RevocationWindowStartedAt)
	if err != nil {
		t.Fatalf("load call cleanup job: %v", err)
	}
	if _, err := s.processCallRevocation(ctx, job); err != nil {
		t.Fatalf("process call cleanup job: %v", err)
	}
	if _, err := db.Exec(ctx, `
		UPDATE call_revocations
		SET processed_at=NOW(),locked_until=NULL
		WHERE id=$1`, job.ID); err != nil {
		t.Fatalf("complete call cleanup job: %v", err)
	}
}
