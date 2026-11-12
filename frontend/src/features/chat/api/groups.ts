import type { ApiRequest } from "../../../shared/types/api";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function getGroupSettings(request: ApiRequest, conversationId: number) {
  return request(`/api/conversations/${conversationId}/group-settings`);
}

export function listGroupMembers(request: ApiRequest, conversationId: number) {
  return request(`/api/conversations/${conversationId}/members`);
}

export function addGroupMembers(request: ApiRequest, conversationId: number, usernames: string[]) {
  return request(`/api/conversations/${conversationId}/members`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ usernames }),
  });
}

export function setGroupMemberRole(request: ApiRequest, conversationId: number, memberId: number, role: string) {
  return request(`/api/conversations/${conversationId}/members/${memberId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ role }),
  });
}

export function removeGroupMember(request: ApiRequest, conversationId: number, memberId: number) {
  return request(`/api/conversations/${conversationId}/members/${memberId}`, { method: "DELETE" });
}
