import type { Dispatch, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { reactToPost } from "../api/posts";
import type { Post } from "../types";

export type UsePostReactionsDeps = {
  actionLocks: RefObject<Set<string>>;
  feedRevisionRef: RefObject<number>;
  followingFeed: { syncPost: (post: Post) => void };
  postSearch: { syncPost: (post: Post) => void };
  refreshPosts: () => Promise<void>;
  setLikePreviews: Dispatch<SetStateAction<Record<number, boolean>>>;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setProfilePosts: Dispatch<SetStateAction<Post[]>>;
  setSavedPosts: Dispatch<SetStateAction<Post[]>>;
};

/** Likes and emoji reactions on posts, with optimistic preview. */
export function usePostReactions({
  actionLocks,
  feedRevisionRef,
  followingFeed,
  postSearch,
  refreshPosts,
  setLikePreviews,
  setPosts,
  setProfilePosts,
  setSavedPosts,
}: UsePostReactionsDeps) {
  const { session, sessionRef } = useSession();
  const { apiFetch } = useApi();
  const { setNotice } = useNotice();
  async function like(post: Post, emoji = "👍") {
      const key = `feed:like:${post.id}`;
      if (actionLocks.current.has(key)) return;
      const sessionId = session?.sessionId;
      actionLocks.current.add(key);
      ++feedRevisionRef.current;
      setLikePreviews((current) => ({ ...current, [post.id]: (post.myReaction || (post.liked ? "👍" : "")) !== emoji }));
      try {
        const response = await reactToPost(apiFetch, post.id, emoji);
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
          ++feedRevisionRef.current;
          actionLocks.current.delete(key);
          setLikePreviews((current) => {
            const next = { ...current };
            delete next[post.id];
            return next;
          });
        }
      }
    }

  return {
    like,
  };
}
