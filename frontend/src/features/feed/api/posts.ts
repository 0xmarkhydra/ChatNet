import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import type { ApiRequest } from "../../../shared/types/api";
import { userLabel } from "../../../shared/utils/userLabel";
import { FEED_PAGE_SIZE, type Post, type PublishLocation } from "../types";
import { parsePostExtras, type PostExtras } from "../utils/postExtras";
type PostVisibility = "public" | "friends" | "private";
type SharedPostExtras = Pick<PostExtras, "location" | "taggedUsernames" | "feelingId">;
const RATE_LIMIT_FALLBACK_MS = 30_000;

export class SharedPostPreviewError extends Error {
  constructor(
    readonly kind: 'session' | 'rate-limited' | 'request' | 'retryable',
    readonly retryAt?: number,
  ) {
    super('Unable to load shared post preview');
  }
}

/** Requests for the Feed posts endpoints. Callers own response handling. */

export type SharedPostPreview = {
  username: string;
  author: string;
  text: string;
  extras: SharedPostExtras;
  createdAt: string;
  attachments: MediaAttachment[];
  likes: number;
  repostKind?: Post['repostKind'];
  originalPost?: {
    username: string;
    author: string;
    text: string;
    extras: SharedPostExtras;
    attachments: MediaAttachment[];
  };
};

export async function getSharedPostPreview(request: ApiRequest, id: number): Promise<SharedPostPreview | null> {
  const response = await request(`/api/posts/${id}`, { cache: "no-store" });
  if (response.status === 204 || response.status === 403 || response.status === 404) return null;
  if (!response.ok) {
    const kind = response.status === 401 ? 'session'
      : response.status === 429 ? 'rate-limited'
        : response.status === 408 || response.status >= 500 ? 'retryable' : 'request';
    const retryAfter = response.headers.get('Retry-After')?.trim();
    const now = Date.now();
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : NaN;
    const parsedDate = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) : NaN;
    const retryDate = Number.isFinite(parsedDate) && new Date(parsedDate).toUTCString() === retryAfter
      ? parsedDate : NaN;
    const retryAt = response.status !== 429 ? undefined
      : Number.isFinite(seconds) ? now + Math.max(0, seconds) * 1000
        : Number.isFinite(retryDate) ? Math.max(now, retryDate)
          : now + RATE_LIMIT_FALLBACK_MS;
    throw new SharedPostPreviewError(kind, Number.isFinite(retryAt) ? retryAt : undefined);
  }
  let post: Post | null;
  try {
    post = await response.json() as Post | null;
  } catch {
    throw new SharedPostPreviewError('retryable');
  }
  if (post?.id !== id || typeof post.author !== "string" || typeof post.content !== "string") {
    throw new SharedPostPreviewError('retryable');
  }
  const attachments = Array.isArray(post.attachments) ? post.attachments : [];
  const extras = parsePostExtras(post.content);
  const originalExtras = post.originalPost ? parsePostExtras(post.originalPost.content) : undefined;
  return {
    username: post.author,
    author: userLabel(typeof post.authorDisplayName === "string" ? post.authorDisplayName : undefined, post.author),
    text: extras.caption,
    extras: {
      location: extras.location,
      taggedUsernames: extras.taggedUsernames,
      feelingId: extras.feelingId,
    },
    createdAt: typeof post.createdAt === 'string' ? post.createdAt : '',
    attachments,
    likes: typeof post.likes === 'number' ? post.likes : 0,
    repostKind: post.repostKind,
    originalPost: post.originalPost ? {
      username: post.originalPost.author,
      author: userLabel(typeof post.originalPost.authorDisplayName === 'string'
        ? post.originalPost.authorDisplayName : undefined, post.originalPost.author),
      text: originalExtras?.caption ?? '',
      extras: {
        location: originalExtras?.location ?? '',
        taggedUsernames: originalExtras?.taggedUsernames ?? [],
        feelingId: originalExtras?.feelingId ?? '',
      },
      attachments: Array.isArray(post.originalPost.attachments) ? post.originalPost.attachments : [],
    } : undefined,
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