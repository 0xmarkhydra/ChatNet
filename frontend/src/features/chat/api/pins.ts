import type { ApiRequest } from "../../../shared/types/api";

export function listPins(request: ApiRequest, conversationId: number) {
  return request(`/api/conversations/${conversationId}/pins`, { cache: "reload" });
}

export function setMessagePinned(request: ApiRequest, messageId: number, pinned: boolean) {
  return request(`/api/messages/${messageId}/pin`, { method: pinned ? "PUT" : "DELETE" });
}

export function setConversationPinned(request: ApiRequest, conversationId: number, pinned: boolean) {
  return request(`/api/conversations/${conversationId}/pin`, { method: pinned ? "PUT" : "DELETE" });
}
