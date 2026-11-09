package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

type groupActivity struct {
	ID          int64      `json:"id"`
	Kind        string     `json:"kind"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	Options     []string   `json:"options"`
	Counts      []int      `json:"counts"`
	MyVote      *int       `json:"myVote"`
	ScheduledAt *time.Time `json:"scheduledAt,omitempty"`
	CreatorName string     `json:"creatorName"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type groupActivityEvent struct {
	ID         int64     `json:"id"`
	ActivityID int64     `json:"activityId"`
	Kind       string    `json:"kind"`
	ActorName  string    `json:"actorName"`
	CreatedAt  time.Time `json:"createdAt"`
}

type newGroupActivity struct {
	Kind        string     `json:"kind"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	Options     []string   `json:"options"`
	ScheduledAt *time.Time `json:"scheduledAt"`
}

func validGroupActivity(v *newGroupActivity) bool {
	v.Title = strings.TrimSpace(v.Title)
	v.Body = strings.TrimSpace(v.Body)
	if utf8.RuneCountInString(v.Title) == 0 || utf8.RuneCountInString(v.Title) > 200 || utf8.RuneCountInString(v.Body) > 5000 {
		return false
	}
	switch v.Kind {
	case "poll":
		if len(v.Options) < 2 || len(v.Options) > 10 || v.ScheduledAt != nil {
			return false
		}
		used := make(map[string]bool, len(v.Options))
		for i, option := range v.Options {
			option = strings.TrimSpace(option)
			normalized := strings.ToLower(option)
			if option == "" || utf8.RuneCountInString(option) > 120 || used[normalized] {
				return false
			}
			used[normalized] = true
			v.Options[i] = option
		}
	case "note":
		if len(v.Options) != 0 || v.ScheduledAt != nil {
			return false
		}
	case "reminder":
		if len(v.Options) != 0 || v.ScheduledAt == nil || !v.ScheduledAt.After(time.Now()) {
			return false
		}
	default:
		return false
	}
	return true
}

// Lock membership for the whole write, so removing a member cannot race a creation/vote.
func groupActivityMemberTx(ctx context.Context, tx pgx.Tx, conversationID, userID int64) error {
	var role string
	return tx.QueryRow(ctx, `SELECT cm.role FROM conversation_members cm
        JOIN conversations c ON c.id=cm.conversation_id AND c.type='group'
        WHERE cm.conversation_id=$1 AND cm.user_id=$2 FOR SHARE OF cm`,
		conversationID, userID).Scan(&role)
}

func (s *server) listGroupActivities(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	if _, err := s.groupRole(r.Context(), id, claims.UserID); err != nil {
		httpx.Error(w, 403, "not a group member")
		return
	}
	activities := make([]groupActivity, 0)
	rows, err := s.db.Query(r.Context(), `SELECT a.id,a.kind,a.title,a.body,a.options,a.scheduled_at,a.created_at,
        COALESCE(NULLIF(u.display_name,''),u.username,'Thành viên đã rời')
        FROM group_activities a LEFT JOIN users u ON u.id=a.creator_id
        WHERE a.conversation_id=$1 AND a.id IN (
          SELECT id FROM (SELECT id FROM group_activities WHERE conversation_id=$1 ORDER BY id DESC LIMIT 200) recent
          UNION
          SELECT activity_id FROM (SELECT activity_id FROM group_activity_events WHERE conversation_id=$1 ORDER BY id DESC LIMIT 200) recent_events)
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id=$2 AND b.blocked_id=a.creator_id) OR
          (b.blocked_id=$2 AND b.blocker_id=a.creator_id))
        ORDER BY a.id DESC LIMIT 400`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot load group activities")
		return
	}
	for rows.Next() {
		var a groupActivity
		var raw []byte
		if err = rows.Scan(&a.ID, &a.Kind, &a.Title, &a.Body, &raw, &a.ScheduledAt, &a.CreatedAt, &a.CreatorName); err != nil {
			break
		}
		if err = json.Unmarshal(raw, &a.Options); err != nil {
			break
		}
		a.Counts = make([]int, len(a.Options))
		activities = append(activities, a)
	}
	if err == nil {
		err = rows.Err()
	}
	rows.Close()
	if err != nil {
		httpx.Error(w, 500, "cannot load group activities")
		return
	}
	byID := make(map[int64]*groupActivity, len(activities))
	for i := range activities {
		byID[activities[i].ID] = &activities[i]
	}
	voteRows, err := s.db.Query(r.Context(), `SELECT v.activity_id,v.option_index,count(*)::int,
        bool_or(v.user_id=$2) FROM group_activity_votes v
        JOIN group_activities a ON a.id=v.activity_id
        WHERE a.conversation_id=$1 AND a.id IN (
          SELECT id FROM (SELECT id FROM group_activities WHERE conversation_id=$1 ORDER BY id DESC LIMIT 200) recent
          UNION
          SELECT activity_id FROM (SELECT activity_id FROM group_activity_events WHERE conversation_id=$1 ORDER BY id DESC LIMIT 200) recent_events)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id=$2 AND b.blocked_id=a.creator_id) OR (b.blocked_id=$2 AND b.blocker_id=a.creator_id)
          OR (b.blocker_id=$2 AND b.blocked_id=v.user_id) OR (b.blocked_id=$2 AND b.blocker_id=v.user_id))
        GROUP BY v.activity_id,v.option_index`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot load votes")
		return
	}
	for voteRows.Next() {
		var activityID int64
		var index, count int
		var mine bool
		if err = voteRows.Scan(&activityID, &index, &count, &mine); err != nil {
			break
		}
		if item := byID[activityID]; item != nil && index >= 0 && index < len(item.Counts) {
			item.Counts[index] = count
			if mine {
				selected := index
				item.MyVote = &selected
			}
		}
	}
	if err == nil {
		err = voteRows.Err()
	}
	voteRows.Close()
	if err != nil {
		httpx.Error(w, 500, "cannot load votes")
		return
	}

	events := make([]groupActivityEvent, 0)
	eventRows, err := s.db.Query(r.Context(), `SELECT e.id,e.activity_id,e.kind,
        COALESCE(NULLIF(u.display_name,''),u.username,'Thành viên đã rời'),e.created_at
        FROM group_activity_events e LEFT JOIN users u ON u.id=e.actor_id
        JOIN group_activities a ON a.id=e.activity_id
        WHERE e.conversation_id=$1 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id=$2 AND b.blocked_id=e.actor_id) OR (b.blocked_id=$2 AND b.blocker_id=e.actor_id)
          OR (b.blocker_id=$2 AND b.blocked_id=a.creator_id) OR (b.blocked_id=$2 AND b.blocker_id=a.creator_id))
        ORDER BY e.id DESC LIMIT 200`, id, claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "cannot load activity events")
		return
	}
	for eventRows.Next() {
		var e groupActivityEvent
		if err = eventRows.Scan(&e.ID, &e.ActivityID, &e.Kind, &e.ActorName, &e.CreatedAt); err != nil {
			break
		}
		events = append(events, e)
	}
	if err == nil {
		err = eventRows.Err()
	}
	eventRows.Close()
	if err != nil {
		httpx.Error(w, 500, "cannot load activity events")
		return
	}
	httpx.JSON(w, 200, map[string]any{"activities": activities, "events": events})
}

func (s *server) createGroupActivity(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	id, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body newGroupActivity
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384)).Decode(&body) != nil || !validGroupActivity(&body) {
		httpx.Error(w, 400, "invalid activity")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot create activity")
		return
	}
	defer tx.Rollback(r.Context())
	if err := groupActivityMemberTx(r.Context(), tx, id, claims.UserID); err != nil {
		httpx.Error(w, 403, "not a group member")
		return
	}
	if body.Options == nil {
		body.Options = []string{}
	}
	options, _ := json.Marshal(body.Options)
	var activityID int64
	err = tx.QueryRow(r.Context(), `INSERT INTO group_activities
        (conversation_id,creator_id,kind,title,body,options,scheduled_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		id, claims.UserID, body.Kind, body.Title, body.Body, options, body.ScheduledAt).Scan(&activityID)
	if err == nil {
		_, err = tx.Exec(r.Context(), `INSERT INTO group_activity_events
            (conversation_id,activity_id,actor_id,kind) VALUES ($1,$2,$3,'created')`,
			id, activityID, claims.UserID)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot create activity")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), id), realtimeEvent{Type: "group.activity", ConversationID: id})
	httpx.JSON(w, 201, map[string]any{"activityId": activityID})
}

func (s *server) voteGroupActivity(w http.ResponseWriter, r *http.Request) {
	claims, _ := authx.ClaimsFromContext(r.Context())
	conversationID, ok := parseID(w, r.PathValue("id"))
	if !ok {
		return
	}
	activityID, ok := parseID(w, r.PathValue("activityId"))
	if !ok {
		return
	}
	var body struct {
		OptionIndex *int `json:"optionIndex"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body) != nil || body.OptionIndex == nil {
		httpx.Error(w, 400, "invalid vote")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "cannot vote")
		return
	}
	defer tx.Rollback(r.Context())
	if err := groupActivityMemberTx(r.Context(), tx, conversationID, claims.UserID); err != nil {
		httpx.Error(w, 403, "not a group member")
		return
	}
	var kind string
	var total int
	err = tx.QueryRow(r.Context(), `SELECT kind,jsonb_array_length(options)
        FROM group_activities a WHERE a.id=$1 AND a.conversation_id=$2
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id=$3 AND b.blocked_id=a.creator_id) OR (b.blocked_id=$3 AND b.blocker_id=a.creator_id))
        FOR UPDATE`, activityID, conversationID, claims.UserID).Scan(&kind, &total)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && kind != "poll") {
		httpx.Error(w, 404, "poll not found")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "cannot vote")
		return
	}
	if *body.OptionIndex < 0 || *body.OptionIndex >= total {
		httpx.Error(w, 400, "invalid poll option")
		return
	}
	var previous int
	previousErr := tx.QueryRow(r.Context(), `SELECT option_index FROM group_activity_votes
        WHERE activity_id=$1 AND user_id=$2`, activityID, claims.UserID).Scan(&previous)
	if previousErr != nil && !errors.Is(previousErr, pgx.ErrNoRows) {
		httpx.Error(w, 500, "cannot vote")
		return
	}
	if previousErr == nil && previous == *body.OptionIndex {
		httpx.JSON(w, 200, map[string]any{"changed": false})
		return
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO group_activity_votes(activity_id,user_id,option_index)
        VALUES ($1,$2,$3) ON CONFLICT(activity_id,user_id)
        DO UPDATE SET option_index=EXCLUDED.option_index,updated_at=NOW()`,
		activityID, claims.UserID, *body.OptionIndex)
	eventKind := "voted"
	if previousErr == nil {
		eventKind = "vote_changed"
	}
	if err == nil {
		_, err = tx.Exec(r.Context(), `INSERT INTO group_activity_events
            (conversation_id,activity_id,actor_id,kind) VALUES ($1,$2,$3,$4)`,
			conversationID, activityID, claims.UserID, eventKind)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "cannot vote")
		return
	}
	s.publishConversationEvent(r.Context(), s.memberIDs(r.Context(), conversationID), realtimeEvent{Type: "group.activity", ConversationID: conversationID})
	httpx.JSON(w, 200, map[string]any{"changed": true})
}
