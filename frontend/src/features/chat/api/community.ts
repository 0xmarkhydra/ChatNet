import type { ApiRequest } from "../../../shared/types/api";

const JSON_HEADERS = { "Content-Type": "application/json" };
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : undefined);

export function getCommunity(request: ApiRequest, groupId: number, signal?: AbortSignal) {
  return request("/api/conversations/" + groupId + "/community", withSignal(signal));
}

export function updateCommunity(request: ApiRequest, groupId: number, metadata: unknown) {
  return request("/api/conversations/" + groupId + "/community", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(metadata),
  });
}

export function getNotificationSettings(request: ApiRequest, groupId: number, signal?: AbortSignal) {
  return request("/api/conversations/" + groupId + "/notification-settings", withSignal(signal));
}

export function saveNotificationSettings(request: ApiRequest, groupId: number, preferences: unknown) {
  return request("/api/conversations/" + groupId + "/notification-settings", {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(preferences),
  });
}

export function listChannels(request: ApiRequest, groupId: number) {
  return request("/api/conversations/" + groupId + "/channels");
}

export function updateChannel(
  request: ApiRequest,
  groupId: number,
  channelId: number,
  channel: { name: string; description: string },
) {
  return request("/api/conversations/" + groupId + "/channels/" + channelId, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name: channel.name, description: channel.description }),
  });
}

export function deleteChannel(request: ApiRequest, groupId: number, channelId: number) {
  return request("/api/conversations/" + groupId + "/channels/" + channelId, { method: "DELETE" });
}

export function listChannelMessages(request: ApiRequest, groupId: number, channelId: number) {
  return request("/api/conversations/" + groupId + "/messages?channelId=" + channelId + "&limit=100");
}

export function sendChannelMessage(
  request: ApiRequest,
  groupId: number,
  message: { text: string; clientId: string; channelId: number },
) {
  return request("/api/conversations/" + groupId + "/messages", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      text: message.text,
      clientId: message.clientId,
      channelId: message.channelId,
      attachments: [],
    }),
  });
}

export function listPublicGroups(request: ApiRequest, query: string, signal: AbortSignal) {
  return request("/api/groups/public?limit=30&q=" + encodeURIComponent(query), { signal });
}

export function joinPublicGroup(request: ApiRequest, groupId: number) {
  return request("/api/groups/" + groupId + "/join", { method: "POST" });
}
