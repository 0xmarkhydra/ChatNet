import type { ApiRequest } from "../../../shared/types/api";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function listInvites(request: ApiRequest, conversationId: number) {
  return request(`/api/conversations/${conversationId}/invites`);
}

export function createInvite(
  request: ApiRequest,
  conversationId: number,
  invite: { expiresInHours: number; maxUses: number },
) {
  return request(`/api/conversations/${conversationId}/invites`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(invite),
  });
}

export function revokeInvite(request: ApiRequest, conversationId: number, inviteId: number) {
  return request(`/api/conversations/${conversationId}/invites/${inviteId}`, { method: "DELETE" });
}

export function listJoinRequests(request: ApiRequest, conversationId: number, reload = false) {
  return request(
    `/api/conversations/${conversationId}/join-requests`,
    reload ? { cache: "reload" } : undefined,
  );
}

export function reviewJoinRequest(
  request: ApiRequest,
  conversationId: number,
  requestId: number,
  approve: boolean,
) {
  return request(`/api/conversations/${conversationId}/join-requests/${requestId}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ approve }),
  });
}

export function listAuditLog(request: ApiRequest, conversationId: number, before?: number) {
  return request(
    `/api/conversations/${conversationId}/admin-audit` + (before === undefined ? "" : `?before=${before}`),
  );
}

export function updateGroupSettings(request: ApiRequest, conversationId: number, settings: unknown) {
  return request(`/api/conversations/${conversationId}/group-settings`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(settings),
  });
}
