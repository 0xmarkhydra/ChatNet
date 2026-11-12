import type { Dispatch, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useSession } from "../../../shared/context/SessionContext";
import { mergeById } from "../../../shared/utils/optimistic";
import { listMyPosts } from "../api/posts";
import { FEED_PAGE_SIZE, type Post } from "../types";

export type UseProfilePostsDeps = {
  feedRevisionRef: RefObject<number>;
  profileLoadSequenceRef: RefObject<number>;
  profilePagingBusyRef: RefObject<boolean>;
  profilePosts: Post[];
  setProfileHasMore: Dispatch<SetStateAction<boolean>>;
  setProfilePosts: Dispatch<SetStateAction<Post[]>>;
  setProfilePostsBusy: Dispatch<SetStateAction<boolean>>;
  setProfilePostsError: Dispatch<SetStateAction<string>>;
};

/** Pages through the signed-in user's own posts for the profile timeline. */
export function useProfilePosts({
  feedRevisionRef,
  profileLoadSequenceRef,
  profilePagingBusyRef,
  profilePosts,
  setProfileHasMore,
  setProfilePosts,
  setProfilePostsBusy,
  setProfilePostsError,
}: UseProfilePostsDeps) {
  const { session, sessionRef } = useSession();
  const { apiFetch } = useApi();
  async function loadProfilePosts(more = false, force = false) {
      if (!session || profilePagingBusyRef.current) return;
      const sessionId = session.sessionId;
      const sequence = ++profileLoadSequenceRef.current;
      const revision = feedRevisionRef.current;
      const before =
        more && profilePosts.length
          ? Math.min(...profilePosts.map((post) => post.id))
          : 0;
      profilePagingBusyRef.current = true;
      setProfilePostsBusy(true);
      setProfilePostsError("");
      try {
        const response = await listMyPosts(apiFetch, { before, force });
        if (!response.ok)
          throw new Error("Không tải được dòng thời gian. Hãy thử lại.");
        const data = (await response.json()) as Post[];
        if (
          sessionRef.current?.sessionId !== sessionId ||
          sequence !== profileLoadSequenceRef.current
        )
          return;
        if (revision !== feedRevisionRef.current)
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
          sequence === profileLoadSequenceRef.current
        ) {
          setProfilePostsError(
            error instanceof Error
              ? error.message
              : "Không tải được dòng thời gian. Hãy thử lại.",
          );
        }
      } finally {
        if (sequence === profileLoadSequenceRef.current) {
          profilePagingBusyRef.current = false;
          if (sessionRef.current?.sessionId === sessionId)
            setProfilePostsBusy(false);
        }
      }
    }

  return {
    loadProfilePosts,
  };
}
