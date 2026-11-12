import type { ApiRequest } from "../../../shared/types/api";

export function getGroupAvatarCapability(request: ApiRequest, groupId: number) {
  return request("/api/conversations/" + groupId + "/avatar", { method: "GET", cache: "no-store" });
}

export function saveGroupAvatar(request: ApiRequest, groupId: number, attachment: unknown) {
  return request("/api/conversations/" + groupId + "/avatar", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attachment }),
  });
}
