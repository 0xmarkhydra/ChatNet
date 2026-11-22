export type GroupActivityKind = "poll" | "note" | "reminder";
export type GroupActivity = {
  id: number;
  kind: GroupActivityKind;
  title: string;
  body: string;
  options: string[];
  counts: number[];
  myVote: number | null;
  scheduledAt?: string;
  pinnedAt?: string;
  creatorName: string;
  createdAt: string;
};
export type GroupActivityEvent = {
  id: number;
  activityId: number;
  kind: "created" | "voted" | "vote_changed";
  actorName: string;
  createdAt: string;
};
export type ActivityData = {
  conversationId: number | null;
  sessionKey?: string;
  activities: GroupActivity[];
  events: GroupActivityEvent[];
};

