import type { ApiRequest } from "../../../shared/types/api";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function listConversations(request: ApiRequest, limit: number, offset?: number) {
  return request(`/api/conversations?limit=${limit}${offset === undefined ? "" : `&offset=${offset}`}`);
}

export function listConversationsByCategory(
  request: ApiRequest,
  { limit, category, offset, force }: { limit: number; category: number; offset: number; force: boolean },
) {
  return request(
    "/api/conversations?limit=" + limit + "&category=" + category + "&offset=" + offset,
    force ? { cache: "reload" } : {},
  );
}

export function findConversation(request: ApiRequest, conversationId: number, signal: AbortSignal) {
  return request(`/api/conversations?limit=1&id=${conversationId}`, { cache: "no-store", signal });
}

export function listMembershipIds(request: ApiRequest, after: number) {
  return request(`/api/conversations/memberships?limit=500&after=${after}`);
}

export function getUnreadSummary(request: ApiRequest, signal: AbortSignal) {
  return request("/api/conversations/unread", { cache: "no-store", signal });
}

export function createDirectConversation(request: ApiRequest, username: string) {
  return request("/api/conversations/direct", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ username }),
  });
}

export function createGroupConversation(
  request: ApiRequest,
  group: { name: string; usernames: string[] } & Record<string, unknown>,
) {
  const { name, usernames, ...extras } = group;
  return request("/api/conversations/groups", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name, usernames, ...extras }),
  });
}

export function clearConversationHistory(request: ApiRequest, conversationId: number) {
  return request(`/api/conversations/${conversationId}/history`, { method: "DELETE" });
}

export function createGroupChannel(
  request: ApiRequest,
  groupId: number,
  channel: { name: string; description: string },
) {
  return request(`/api/conversations/${groupId}/channels`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name: channel.name, description: channel.description }),
  });
}
