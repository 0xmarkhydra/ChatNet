import { type Post, FEED_PAGE_SIZE } from "../types";
import { mergeById } from "../../../shared/utils/optimistic";
import { FormEvent, type SetStateAction } from "react";
import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import { type Session } from "../../auth/lib/session";
import { type ToastKind } from "../../notifications/utils/toast";
import { type FeedComment } from "../components/FeedDiscussion";
import type { Tab } from "../../../app/types";
import type { Dispatch, RefObject } from "react";

export type UseFeedActionsDeps = {
  actionLocks: RefObject<Set<string>>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  feedCheckInLocation: string;
  feedCheckInOpen: boolean;
  feedRevision: RefObject<number>;
  feedScrollBeforeComments: RefObject<number | null>;
  feedViewRef: RefObject<HTMLDivElement | null>;
  followingFeed: { refresh: () => void; syncPost: (post: Post) => void; removePost: (id: number) => void; posts: Post[]; loading: boolean; loadingMore: boolean; hasMore: boolean; error: string; loadMore: () => Promise<void>; };
  isProfileDesktop: boolean;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  name: string;
  postAttachments: MediaAttachment[];
  postBackground: string;
  postSearch: { posts: Post[]; loading: boolean; loadingMore: boolean; hasMore: boolean; error: string; loadMore: (retryOnError?: boolean) => Promise<void>; retry: () => void; syncPost: (updated: Post) => void; removePost: (id: number) => void; };
  postText: string;
  postVisibility: "public" | "friends" | "private";
  profileLoadSequence: RefObject<number>;
  profilePagingBusy: RefObject<boolean>;
  profilePosts: Post[];
  refreshPosts: () => Promise<void>;
  removeFeedDataPost: (id: number) => void;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setActivePostId: Dispatch<SetStateAction<number | null>>;
  setFeedCheckInLocation: Dispatch<SetStateAction<string>>;
  setFeedCheckInOpen: Dispatch<SetStateAction<boolean>>;
  setFeedComposerOpen: Dispatch<SetStateAction<boolean>>;
  setLikePreviews: Dispatch<SetStateAction<Record<number, boolean>>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setPendingComments: Dispatch<SetStateAction<Record<number, FeedComment>>>;
  setPendingPost: Dispatch<SetStateAction<Post | null>>;
  setPostAttachments: Dispatch<SetStateAction<MediaAttachment[]>>;
  setPostBackground: Dispatch<SetStateAction<string>>;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setPostSubmitError: Dispatch<SetStateAction<string>>;
  setPostText: Dispatch<SetStateAction<string>>;
  setProfileComposerOpen: Dispatch<SetStateAction<boolean>>;
  setProfileHasMore: Dispatch<SetStateAction<boolean>>;
  setProfilePosts: Dispatch<SetStateAction<Post[]>>;
  setProfilePostsBusy: Dispatch<SetStateAction<boolean>>;
  setProfilePostsError: Dispatch<SetStateAction<string>>;
  setSavedPosts: Dispatch<SetStateAction<Post[]>>;
  setShowPostBackgrounds: Dispatch<SetStateAction<boolean>>;
  syncFeedDataPost: (updated: Post) => void;
  tab: Tab;
};

export function useFeedActions({
  actionLocks,
  apiFetch,
  feedCheckInLocation,
  feedCheckInOpen,
  feedRevision,
  feedScrollBeforeComments,
  feedViewRef,
  followingFeed,
  isProfileDesktop,
  mediaUploading,
  name,
  postAttachments,
  postBackground,
  postSearch,
  postText,
  postVisibility,
  profileLoadSequence,
  profilePagingBusy,
  profilePosts,
  refreshPosts,
  removeFeedDataPost,
  session,
  sessionRef,
  setActivePostId,
  setFeedCheckInLocation,
  setFeedCheckInOpen,
  setFeedComposerOpen,
  setLikePreviews,
  setNotice,
  setPendingComments,
  setPendingPost,
  setPostAttachments,
  setPostBackground,
  setPosts,
  setPostSubmitError,
  setPostText,
  setProfileComposerOpen,
  setProfileHasMore,
  setProfilePosts,
  setProfilePostsBusy,
  setProfilePostsError,
  setSavedPosts,
  setShowPostBackgrounds,
  syncFeedDataPost,
  tab,
}: UseFeedActionsDeps) {  function syncFeedPost(updated: Post) {
    ++feedRevision.current;
    setProfilePosts((current) =>
      current.map((p) => (p.id === updated.id ? updated : p)),
    );
    syncFeedDataPost(updated);
    followingFeed.syncPost(updated);
    postSearch.syncPost(updated);
  }
  function removeFeedPost(id: number) {
    ++feedRevision.current;
    setProfilePosts((current) => current.filter((p) => p.id !== id));
    removeFeedDataPost(id);
    followingFeed.removePost(id);
    postSearch.removePost(id);
  }
  async function loadProfilePosts(more = false, force = false) {
    if (!session || profilePagingBusy.current) return;
    const sessionId = session.sessionId;
    const sequence = ++profileLoadSequence.current;
    const revision = feedRevision.current;
    const before =
      more && profilePosts.length
        ? Math.min(...profilePosts.map((post) => post.id))
        : 0;
    profilePagingBusy.current = true;
    setProfilePostsBusy(true);
    setProfilePostsError("");
    try {
      const response = await apiFetch(
        `/api/posts?scope=mine&limit=${FEED_PAGE_SIZE}${before ? "&before=" + before : ""}`,
        force ? { cache: "reload" } : {},
      );
      if (!response.ok)
        throw new Error("Không tải được dòng thời gian. Hãy thử lại.");
      const data = (await response.json()) as Post[];
      if (
        sessionRef.current?.sessionId !== sessionId ||
        sequence !== profileLoadSequence.current
      )
        return;
      if (revision !== feedRevision.current)
        throw new Error(
          "Dòng thời gian vừa thay đổi. Hãy tải lại để cập nhật.",
        );
      if (
        !Array.isArray(data) ||
        data.some(
          (post) =>
            !Number.isSafeInteger(post.id) ||
            post.id <= 0 ||
            post.author !== sessionRef.current?.user.username,
        )
      ) {
        throw new Error("Dữ liệu dòng thời gian không hợp lệ. Hãy tải lại.");
      }
      setProfilePosts((current) =>
        more
          ? data.reduce((items, post) => mergeById(items, post), current)
          : data,
      );
      setProfileHasMore(data.length === FEED_PAGE_SIZE);
    } catch (error) {
      if (
        sessionRef.current?.sessionId === sessionId &&
        sequence === profileLoadSequence.current
      ) {
        setProfilePostsError(
          error instanceof Error
            ? error.message
            : "Không tải được dòng thời gian. Hãy thử lại.",
        );
      }
    } finally {
      if (sequence === profileLoadSequence.current) {
        profilePagingBusy.current = false;
        if (sessionRef.current?.sessionId === sessionId)
          setProfilePostsBusy(false);
      }
    }
  }
  async function createPost(event: FormEvent) {
    event.preventDefault();
    if (
      !session ||
      actionLocks.current.has("feed:create") ||
      mediaUploading ||
      (!postText.trim() &&
        postAttachments.length === 0 &&
        !(feedCheckInOpen && feedCheckInLocation.trim()))
    )
      return;

    setPostSubmitError("");
    const locationText = feedCheckInOpen ? feedCheckInLocation.trim() : "";
    const content = [locationText ? `📍 ${locationText}` : "", postText.trim()]
      .filter(Boolean)
      .join("\n");
    const attachments = postAttachments;
    const visibility = postVisibility;
    const background = postBackground;
    const sessionId = session.sessionId;
    actionLocks.current.add("feed:create");
    ++feedRevision.current;
    setPendingPost({
      id: -1,
      author: name,
      authorDisplayName: session?.user.displayName,
      content,
      visibility,
      background,
      attachments,
      likes: 0,
      liked: false,
      comments: [],
      createdAt: new Date().toISOString(),
    });
    try {
      const response = await apiFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          attachments: attachments.map(attachmentRequestBody),
          visibility,
          background,
        }),
      });
      const post = (await response.json()) as Post & { error?: string };
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || !Number.isSafeInteger(post.id) || post.id <= 0)
        throw new Error(post.error || "Không đăng được bài viết");
      setPosts((current) => [
        post,
        ...current.filter((item) => item.id !== post.id),
      ]);
      setProfilePosts((current) => [
        post,
        ...current.filter((item) => item.id !== post.id),
      ]);
      setPostText("");
      setPostAttachments([]);
      setPostBackground("");
      setShowPostBackgrounds(false);
      setProfileComposerOpen(false);
      setFeedComposerOpen(false);
      setFeedCheckInOpen(false);
      setFeedCheckInLocation("");
      setNotice("Đã đăng bài viết.", "success");
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) {
        const message =
          error instanceof Error
            ? error.message
            : "Không đăng được bài viết. Bản nháp được giữ lại.";
        setPostSubmitError(message);
        setNotice(message, "error");
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current;
        actionLocks.current.delete("feed:create");
        setPendingPost(null);
      }
    }
  }
  async function like(post: Post, emoji = "👍") {
    const key = `feed:like:${post.id}`;
    if (actionLocks.current.has(key)) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    ++feedRevision.current;
    setLikePreviews((current) => ({ ...current, [post.id]: (post.myReaction || (post.liked ? "👍" : "")) !== emoji }));
    try {
      const response = await apiFetch(`/api/posts/${post.id}/${emoji === "👍" ? "like" : "reactions"}`, {
        method: "POST",
        ...(emoji !== "👍" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) } : {}),
      });
      const updated = (await response.json()) as Post & { error?: string };
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (
        !response.ok ||
        updated.id !== post.id ||
        typeof updated.liked !== "boolean" ||
        !Number.isFinite(updated.likes)
      ) {
        throw new Error(updated.error || "Không cập nhật được lượt thích.");
      }
      setPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, liked: updated.liked, likes: updated.likes, myReaction: updated.myReaction, reactions: updated.reactions }
            : item,
        ),
      );
      setSavedPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, liked: updated.liked, likes: updated.likes, myReaction: updated.myReaction, reactions: updated.reactions }
            : item,
        ),
      );
      setProfilePosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, liked: updated.liked, likes: updated.likes, myReaction: updated.myReaction, reactions: updated.reactions }
            : item,
        ),
      );
      followingFeed.syncPost({
        ...post,
        liked: updated.liked,
        likes: updated.likes,
        myReaction: updated.myReaction,
        reactions: updated.reactions,
      });
      postSearch.syncPost({
        ...post,
        liked: updated.liked,
        likes: updated.likes,
        myReaction: updated.myReaction,
        reactions: updated.reactions,
      });
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) void refreshPosts();
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error
            ? error.message
            : "Không cập nhật được lượt thích.",
          "error",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current;
        actionLocks.current.delete(key);
        setLikePreviews((current) => {
          const next = { ...current };
          delete next[post.id];
          return next;
        });
      }
    }
  }
  async function manageFeedComment(
    post: Post,
    commentId: number,
    method: "PATCH" | "DELETE",
    content?: string,
  ) {
    const response = await apiFetch(
      "/api/posts/" + post.id + "/comments/" + commentId,
      {
        method,
        ...(method === "PATCH"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            }
          : {}),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(data.error || "Không cập nhật được bình luận");
    }
    const updated = (await response.json()) as Post;
    syncFeedPost(updated);
    setNotice(
      method === "PATCH" ? "Đã sửa bình luận." : "Đã xóa bình luận.",
      "success",
    );
  }
  async function reportFeedComment(commentId: number, reason: string) {
    const response = await apiFetch("/api/feed/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "comment",
        targetId: commentId,
        reason,
      }),
    });
    if (!response.ok) throw new Error("Không thể gửi báo cáo bình luận.");
    setNotice("Đã gửi báo cáo bình luận.", "success");
  }
  async function addComment(post: Post, content: string, parentId?: number) {
    const sessionId = session?.sessionId;
    const key = `feed:comment:${post.id}`;
    if (actionLocks.current.has(key))
      throw new Error("Bình luận đang được gửi.");
    actionLocks.current.add(key);
    ++feedRevision.current;
    setPendingComments((current) => ({
      ...current,
      [post.id]: {
        id: -1,
        parentId,
        author: name,
        authorDisplayName: session?.user.displayName,
        content,
        createdAt: new Date().toISOString(),
      },
    }));
    try {
      const response = await apiFetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId }),
      });
      if (!response.ok)
        throw new Error(
          "Chưa xác nhận được bình luận. Bản nháp được giữ lại; kiểm tra bài viết trước khi gửi lại.",
        );
      const updated = (await response.json()) as Post;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (updated.id !== post.id || !Array.isArray(updated.comments))
        throw new Error("Phản hồi không hợp lệ. Bản nháp được giữ lại.");
      setPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, comments: updated.comments }
            : item,
        ),
      );
      setSavedPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, comments: updated.comments }
            : item,
        ),
      );
      setProfilePosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, comments: updated.comments }
            : item,
        ),
      );
      followingFeed.syncPost({ ...post, comments: updated.comments });
      postSearch.syncPost({ ...post, comments: updated.comments });
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current;
        actionLocks.current.delete(key);
        setPendingComments((current) => {
          const next = { ...current };
          delete next[post.id];
          return next;
        });
      }
    }
  }
  function openFeedPostDetails(id: number) {
    if (tab === "feed" && isProfileDesktop) {
      feedScrollBeforeComments.current = feedViewRef.current?.scrollTop ?? 0;
      const url = new URL(window.location.href);
      if (url.searchParams.get("post") !== String(id)) {
        url.searchParams.set("tab", "feed");
        url.searchParams.set("post", String(id));
        window.history.pushState({ ...window.history.state, postId: id }, "", url);
      }
    }
    setActivePostId(id);
  }
  function closeFeedPostDetails() {
    setActivePostId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("post")) {
      url.searchParams.delete("post");
      window.history.replaceState(window.history.state, "", url);
    }
  }

  return {
    addComment,
    closeFeedPostDetails,
    createPost,
    like,
    loadProfilePosts,
    manageFeedComment,
    openFeedPostDetails,
    removeFeedPost,
    reportFeedComment,
    syncFeedPost,
  };
}
