import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import type { ApiRequest } from "../../../shared/types/api";
import { userLabel } from "../../../shared/utils/userLabel";
import { FEED_PAGE_SIZE, type Post, type PublishLocation } from "../types";
import { parsePostExtras } from "../utils/postExtras";

type PostVisibility = "public" | "friends" | "private";

/** Requests for the Feed posts endpoints. Callers own response handling. */

export type SharedPostPreview = {
  author: string;
  text: string;
  image?: string;
  mediaLabel?: string;
};

export async function getSharedPostPreview(request: ApiRequest, id: number): Promise<SharedPostPreview | null> {
  const response = await request(`/api/posts/${id}`, { cache: "no-store" });
  if (!response.ok) return null;
  const post = await response.json() as Post | null;
  if (post?.id !== id || typeof post.author !== "string" || typeof post.content !== "string") return null;
  const attachments = Array.isArray(post.attachments) ? post.attachments : [];
  const image = attachments.find(item => item?.kind === "image" && typeof item.url === "string" &&
    /^https?:\/\//i.test(item.url))?.url;
  const mediaLabel = attachments.some(item => item?.kind === "video") ? "Bài viết có video"
    : attachments.some(item => item?.kind === "image") ? "Bài viết có ảnh"
    : attachments.length ? "Bài viết có tệp đính kèm" : undefined;
  const extras = parsePostExtras(post.content);
  return {
    author: userLabel(typeof post.authorDisplayName === "string" ? post.authorDisplayName : undefined, post.author),
    text: extras.caption || post.content.trim(),
    image,
    mediaLabel,
  };
}

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
    publishLocation?: PublishLocation;
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
      publishLocation: input.publishLocation,
    }),
  });
}

export function patchPost(
  request: ApiRequest,
  id: number,
  input: { content: string; visibility: PostVisibility; background: string; publishLocation?: PublishLocation },
) {
  return request(`/api/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: input.content,
      visibility: input.visibility,
      background: input.background,
      publishLocation: input.publishLocation,
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

export function publishRepost(request: ApiRequest, id: number, kind: "quick" | "quote", content: string) {
  return request(`/api/posts/${id}/repost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, content }),
  });
}

export function undoRepost(request: ApiRequest, id: number) {
  return request(`/api/posts/${id}/repost`, { method: "DELETE" });
}