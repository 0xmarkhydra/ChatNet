import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Post } from "../types";

export type UsePostSyncDeps = {
  feedRevisionRef: RefObject<number>;
  followingFeed: { syncPost: (post: Post) => void; removePost: (id: number) => void };
  postSearch: { syncPost: (post: Post) => void; removePost: (id: number) => void };
  removeFeedDataPost: (id: number) => void;
  setProfilePosts: Dispatch<SetStateAction<Post[]>>;
  syncFeedDataPost: (updated: Post) => void;
};

/** Keeps every cached copy of a post (feed, following, search, profile) in step. */
export function usePostSync({
  feedRevisionRef,
  followingFeed,
  postSearch,
  removeFeedDataPost,
  setProfilePosts,
  syncFeedDataPost,
}: UsePostSyncDeps) {
  function syncFeedPost(updated: Post) {
      ++feedRevisionRef.current;
      setProfilePosts((current) =>
        current.map((p) => (p.id === updated.id ? updated : p)),
      );
      syncFeedDataPost(updated);
      followingFeed.syncPost(updated);
      postSearch.syncPost(updated);
    }
  function removeFeedPost(id: number) {
      ++feedRevisionRef.current;
      setProfilePosts((current) => current.filter((p) => p.id !== id));
      removeFeedDataPost(id);
      followingFeed.removePost(id);
      postSearch.removePost(id);
    }

  return {
    removeFeedPost,
    syncFeedPost,
  };
}
