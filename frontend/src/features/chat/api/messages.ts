import type { ApiRequest } from "../../../shared/types/api";

/** Requests for Chat message endpoints. Callers own response handling. */

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function getConversationEncryptionStatus(
  request: ApiRequest,
  conversationId: number,
): Promise<'legacy' | 'e2ee' | 'pending'> {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
    throw new Error('Invalid conversation ID')
  }
  const response = await request(`/api/conversations/${conversationId}/e2ee/status`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Cannot verify encryption status; sending blocked')
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' ||
      !('mode' in body) ||
      (body.mode !== 'legacy' && body.mode !== 'e2ee')) {
    throw new Error('Invalid encryption status response; sending blocked')
  }
  // New direct chats on an E2EE-by-default environment must never place
  // plaintext into the legacy local outbox while MLS enrollment is pending.
  if (body.mode === 'legacy' &&
      'autoEnabled' in body && body.autoEnabled === true) return 'pending'
  return body.mode
}

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
