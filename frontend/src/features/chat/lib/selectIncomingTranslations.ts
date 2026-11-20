import type { Message } from "../types";

export function selectIncomingMessagesForTranslation({
  messages,
  userId,
  sessionId,
  targetLanguage,
  translations,
  attempted,
}: {
  messages: readonly Message[];
  userId: number;
  sessionId: string;
  targetLanguage: string;
  translations: Readonly<Record<number, string>>;
  attempted: ReadonlySet<string>;
}): Message[] {
  return messages.filter(message =>
    !message.deleted &&
    message.senderId !== userId &&
    Boolean(message.text.trim()) &&
    !translations[message.id] &&
    !attempted.has(`${sessionId}:${targetLanguage}:${message.id}:${message.editedAt ?? ""}`),
  );
}
