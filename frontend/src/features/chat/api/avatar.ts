import type { ApiRequest } from "../../../shared/types/api";

function avatarPath(groupId: number, channelId = 0) {
  return `/api/conversations/${groupId}${channelId > 0 ? `/channels/${channelId}` : ""}/avatar`;
}

export function getGroupAvatarCapability(request: ApiRequest, groupId: number, channelId = 0) {
  return request(avatarPath(groupId, channelId), { method: "GET", cache: "no-store" });
}

export function saveGroupAvatar(request: ApiRequest, groupId: number, attachment: unknown, channelId = 0) {
  return request(avatarPath(groupId, channelId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attachment }),
  });
}