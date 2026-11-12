import type { ApiRequest } from "../../../shared/types/api";

/** `query` is an already encoded query string such as `limit=30&search=hello`. */
export function searchMessages(request: ApiRequest, conversationId: number, query: string) {
  return request("/api/conversations/" + conversationId + "/messages?" + query);
}

export function searchMoreMessages(request: ApiRequest, conversationId: number, query: string, before: number) {
  return request("/api/conversations/" + conversationId + "/messages?" + query + "&before=" + before);
}

export function listChannelSharedFiles(request: ApiRequest, conversationId: number, channelId: number) {
  return request("/api/conversations/" + conversationId + "/shared?kind=files&channelId=" + channelId + "&limit=48");
}

export function listSharedFilesBefore(request: ApiRequest, conversationId: number, before: number) {
  return request("/api/conversations/" + conversationId + "/shared?kind=files&limit=48&before=" + before);
}

export function listSharedFiles(request: ApiRequest, conversationId: number, signal: AbortSignal) {
  return request(`/api/conversations/${conversationId}/shared?kind=files&limit=48`, { signal });
}
