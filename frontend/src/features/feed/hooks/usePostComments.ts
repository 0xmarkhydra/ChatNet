import type { Dispatch, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { changeComment, reportComment, submitComment } from "../api/comments";
import type { FeedComment } from "../components/FeedDiscussion";
import type { Post } from "../types";

export type UsePostCommentsDeps = {
  actionLocks: RefObject<Set<string>>;
  feedRevisionRef: RefObject<number>;
  followingFeed: { syncPost: (post: Post) => void };
  name: string;
  postSearch: { syncPost: (post: Post) => void };
  setPendingComments: Dispatch<SetStateAction<Record<number, FeedComment>>>;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setProfilePosts: Dispatch<SetStateAction<Post[]>>;
  setSavedPosts: Dispatch<SetStateAction<Post[]>>;
  syncFeedPost: (updated: Post) => void;
};

/** Adds, edits, deletes and reports comments on posts. */
export function usePostComments({
  actionLocks,
  feedRevisionRef,
  followingFeed,
  name,
  postSearch,
  setPendingComments,
  setPosts,
  setProfilePosts,
  setSavedPosts,
  syncFeedPost,
}: UsePostCommentsDeps) {
  const { session, sessionRef } = useSession();
  const { apiFetch } = useApi();
  const { setNotice } = useNotice();
  async function manageFeedComment(
      post: Post,
      commentId: number,
      method: "PATCH" | "DELETE",
      content?: string,
    ) {
      const response = await changeComment(apiFetch, post.id, commentId, method, content);
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
      const response = await reportComment(apiFetch, commentId, reason);
      if (!response.ok) throw new Error("Không thể gửi báo cáo bình luận.");
      setNotice("Đã gửi báo cáo bình luận.", "success");
    }
  async function addComment(post: Post, content: string, parentId?: number) {
      const sessionId = session?.sessionId;
      const key = `feed:comment:${post.id}`;
      if (actionLocks.current.has(key))
        throw new Error("Bình luận đang được gửi.");
      actionLocks.current.add(key);
      ++feedRevisionRef.current;
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
        const response = await submitComment(apiFetch, post.id, content, parentId);
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
          ++feedRevisionRef.current;
          actionLocks.current.delete(key);
          setPendingComments((current) => {
            const next = { ...current };
            delete next[post.id];
            return next;
          });
        }
      }
    }

  return {
    addComment,
    manageFeedComment,
    reportFeedComment,
  };
}
