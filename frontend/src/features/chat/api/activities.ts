import type { ApiRequest } from "../../../shared/types/api";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function listActivities(request: ApiRequest, conversationId: number) {
  return request(`/api/conversations/${conversationId}/activities`, { cache: "no-store" });
}

export function createActivity(request: ApiRequest, conversationId: number, payload: unknown) {
  return request(`/api/conversations/${conversationId}/activities`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export function setActivityPinned(request: ApiRequest, conversationId: number, id: number, pinned: boolean) {
  return request(`/api/conversations/${conversationId}/activities/${id}/pin`, {
    method: pinned ? "PUT" : "DELETE",
  });
}

export function voteActivity(request: ApiRequest, conversationId: number, id: number, optionIndex: number) {
  return request(`/api/conversations/${conversationId}/activities/${id}/vote`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ optionIndex }),
  });
}
