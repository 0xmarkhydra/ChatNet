import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Tab } from "../../../app/types";
import type { ToastKind } from "../../notifications/utils/toast";
import type { Post } from "../types";
import type { PostMentionNotification } from "../utils/postMentionNotifications";

export type UsePostMentionsDeps = {
  sessionId: string | undefined;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  notificationsOpen: boolean;
  setNotice: (message: string, kind?: ToastKind) => void;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setFeedCommunitiesOpen: Dispatch<SetStateAction<boolean>>;
  setTab: (tab: Tab) => void;
  setActivePostId: Dispatch<SetStateAction<number | null>>;
};

export function usePostMentions({
  sessionId,
  apiFetch,
  notificationsOpen,
  setNotice,
  setPosts,
  setFeedCommunitiesOpen,
  setTab,
  setActivePostId,
}: UsePostMentionsDeps) {
  const [postMentions, setPostMentions] = useState<PostMentionNotification[]>([]);
  useEffect(() => {
    if (!sessionId) {
      setPostMentions([]);
      return;
    }
    let live = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await apiFetch("/api/feed/mentions", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const items: unknown = await response.json();
        if (live && Array.isArray(items)) {
          setPostMentions(items.filter((item): item is PostMentionNotification =>
            item && Number.isSafeInteger(item.id) && Number.isSafeInteger(item.postId)
            && typeof item.author === "string" && typeof item.createdAt === "string"));
        }
      } catch {
        // A temporary network outage must not clear already received alerts.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), notificationsOpen ? 12000 : 30000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, notificationsOpen]);

  async function readPostMention(id: number) {
    const mention = postMentions.find(item => item.id === id);
    if (!mention || mention.readAt) return;
    try {
      const response = await apiFetch(`/api/feed/mentions/${id}/read`, { method: "POST" });
      if (!response.ok) throw new Error("Không đánh dấu được thông báo.");
      setPostMentions(current => current.map(item => item.id === id
        ? { ...item, readAt: new Date().toISOString() } : item));
    } catch {
      setNotice("Không đánh dấu được thông báo. Vui lòng thử lại.", "error");
    }
  }

  async function openMentionPost(mention: PostMentionNotification) {
    try {
      const response = await apiFetch(`/api/posts/${mention.postId}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404
        ? "Bài viết không tồn tại hoặc bạn không còn quyền xem."
        : "Không mở được bài viết.");
      const post = await response.json() as Post;
      setPosts(current => [post, ...current.filter(item => item.id !== post.id)]);
      setFeedCommunitiesOpen(false);
      setTab("feed");
      setActivePostId(post.id);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "feed");
      url.searchParams.set("post", String(post.id));
      window.history.pushState({ ...window.history.state, postId: post.id }, "", url);
      void readPostMention(mention.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không mở được bài viết.", "error");
    }
  }

  return { postMentions, openMentionPost, readPostMention };
}
