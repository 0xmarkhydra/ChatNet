import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import type { ApiRequest } from "../../../shared/types/api";
import { FEED_PAGE_SIZE } from "../types";

type PostVisibility = "public" | "friends" | "private";

/** Requests for the Feed posts endpoints. Callers own response handling. */

export function listMyPosts(
  request: ApiRequest,
  { before, force }: { before: number; force: boolean },
) {
  return request(
    `/api/posts?scope=mine&limit=${FEED_PAGE_SIZE}${before ? "&before=" + before : ""}`,
    force ? { cache: "reload" } : {},
  );
}

export function submitPost(
  request: ApiRequest,
  input: {
    content: string;
    attachments: MediaAttachment[];
    visibility: PostVisibility;
    background: string;
  },
) {
  return request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: input.content,
      attachments: input.attachments.map(attachmentRequestBody),
      visibility: input.visibility,
      background: input.background,
    }),
  });
}

export function patchPost(
  request: ApiRequest,
  id: number,
  input: { content: string; visibility: PostVisibility; background: string },
) {
  return request(`/api/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: input.content,
      visibility: input.visibility,
      background: input.background,
    }),
  });
}

export function reactToPost(request: ApiRequest, id: number, emoji: string) {
  return request(`/api/posts/${id}/${emoji === "👍" ? "like" : "reactions"}`, {
    method: "POST",
    ...(emoji !== "👍"
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) }
      : {}),
  });
}
