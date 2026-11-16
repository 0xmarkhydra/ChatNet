import type { ApiRequest } from "../../../shared/types/api";

export function previewGroupInvite(request: ApiRequest, token: string) {
  return request(`/api/group-invites/${token}`);
}

export function joinGroupInvite(request: ApiRequest, token: string) {
  return request(`/api/group-invites/${token}/join`, { method: "POST" });
}
