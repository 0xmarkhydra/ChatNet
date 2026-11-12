import type { ApiRequest } from "../../../shared/types/api";

/** Requests for Chat message endpoints. Callers own response handling. */

const JSON_HEADERS = { "Content-Type": "application/json" };

export type SendMessageInput = {
  conversationId: number;
  text: string;
  attachments: unknown;
  clientId: string;
  channelId?: number;
  replyToMessageId?: number;
};

export function sendMessage(request: ApiRequest, item: SendMessageInput) {
  return request(`/api/conversations/${item.conversationId}/messages`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      text: item.text,
      attachments: item.attachments,
      clientId: item.clientId,
      ...(item.channelId ? { channelId: item.channelId } : {}),
      ...(item.replyToMessageId
        ? { replyToMessageId: item.replyToMessageId }
        : {}),
    }),
  });
}

export function editMessage(request: ApiRequest, messageId: number, text: string) {
  return request(`/api/messages/${messageId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ text }),
  });
}

export function recallMessage(request: ApiRequest, messageId: number) {
  return request(`/api/messages/${messageId}`, { method: "DELETE" });
}

export function reactToMessage(request: ApiRequest, messageId: number, emoji: string) {
  return request(`/api/messages/${messageId}/reactions`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ emoji }),
  });
}

export type MessagePageQuery = {
  conversationId: number;
  target: string;
  channelId: number;
  limit: number;
  before?: number;
};

export function listMessages(request: ApiRequest, query: MessagePageQuery) {
  const before = query.before === undefined ? "" : `&before=${query.before}`;
  return request(
    `/api/conversations/${query.conversationId}/messages?target=${encodeURIComponent(query.target)}&channelId=${query.channelId}&limit=${query.limit}${before}`,
  );
}

export function markConversationRead(request: ApiRequest, conversationId: number) {
  return request(`/api/conversations/${conversationId}/read`, { method: "POST" });
}

export function markChannelRead(request: ApiRequest, conversationId: number, channelId: number) {
  return request(`/api/conversations/${conversationId}/channel-read`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ channelId }),
  });
}
