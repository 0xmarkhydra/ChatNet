import type { Message } from "../types";

// A short pause from the same sender is one visual burst, not a new message block.
export const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

type GroupingMessage = Pick<Message, "id" | "senderId" | "createdAt">;
type Interruption = { createdAt: string };

export type MessageGroupPosition = "single" | "start" | "middle" | "end";

export function areMessagesInSameBurst(
  earlier: GroupingMessage | null | undefined,
  later: GroupingMessage | null | undefined,
): boolean {
  if (!earlier || !later || earlier.senderId !== later.senderId) return false;
  const start = new Date(earlier.createdAt);
  const end = new Date(later.createdAt);
  const elapsed = end.getTime() - start.getTime();
  return Number.isFinite(elapsed) &&
    elapsed >= 0 &&
    elapsed <= MESSAGE_GROUP_WINDOW_MS &&
    start.toDateString() === end.toDateString();
}

export function getMessageGroupPosition(
  messages: readonly GroupingMessage[],
  index: number,
  options: {
    gapBeforeId?: number | null;
    unreadBeforeId?: number | null;
    interruptions?: readonly Interruption[];
  } = {},
): MessageGroupPosition {
  const message = messages[index];
  if (!message) return "single";

  const noInterruption = (earlier: GroupingMessage, later: GroupingMessage) =>
    !(options.interruptions || []).some((item) => {
      const when = Date.parse(item.createdAt);
      return Number.isFinite(when) &&
        when > Date.parse(earlier.createdAt) &&
        when <= Date.parse(later.createdAt);
    });

  const previous = messages[index - 1];
  const next = messages[index + 1];
  const joinsPrevious = Boolean(
    previous &&
    options.gapBeforeId !== message.id && options.unreadBeforeId !== message.id &&
    areMessagesInSameBurst(previous, message) &&
    noInterruption(previous, message),
  );
  const joinsNext = Boolean(
    next &&
    options.gapBeforeId !== next.id && options.unreadBeforeId !== next.id &&
    areMessagesInSameBurst(message, next) &&
    noInterruption(message, next),
  );

  if (joinsPrevious && joinsNext) return "middle";
  if (joinsPrevious) return "end";
  if (joinsNext) return "start";
  return "single";
}