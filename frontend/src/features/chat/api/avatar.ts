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

export function getChannelAvatarCapability(request: ApiRequest, groupId: number, channelId: number) {
  return request("/api/conversations/" + groupId + "/channels/" + channelId + "/avatar", { cache: "no-store" });
}

export function saveChannelAvatar(request: ApiRequest, groupId: number, channelId: number, attachment: unknown) {
  return request("/api/conversations/" + groupId + "/channels/" + channelId + "/avatar", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attachment }),
  });
}
