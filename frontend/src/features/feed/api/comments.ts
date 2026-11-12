import type { ApiRequest } from "../../../shared/types/api";

/** Requests for Feed comment endpoints. Callers own response handling. */

export function submitComment(
  request: ApiRequest,
  postId: number,
  content: string,
  parentId?: number,
) {
  return request(`/api/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, parentId }),
  });
}

export function changeComment(
  request: ApiRequest,
  postId: number,
  commentId: number,
  method: "PATCH" | "DELETE",
  content?: string,
) {
  return request("/api/posts/" + postId + "/comments/" + commentId, {
    method,
    ...(method === "PATCH"
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      : {}),
  });
}

export function reportComment(request: ApiRequest, commentId: number, reason: string) {
  return request("/api/feed/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetType: "comment",
      targetId: commentId,
      reason,
    }),
  });
}
