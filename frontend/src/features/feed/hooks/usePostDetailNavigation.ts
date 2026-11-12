import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Tab } from "../../../shared/types/navigation";

export type UsePostDetailNavigationDeps = {
  feedScrollBeforeComments: RefObject<number | null>;
  feedViewRef: RefObject<HTMLDivElement | null>;
  isProfileDesktop: boolean;
  setActivePostId: Dispatch<SetStateAction<number | null>>;
  tab: Tab;
};

/** Opens and closes the post detail view and keeps the shareable ?post= URL in step. */
export function usePostDetailNavigation({
  feedScrollBeforeComments,
  feedViewRef,
  isProfileDesktop,
  setActivePostId,
  tab,
}: UsePostDetailNavigationDeps) {
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
    closeFeedPostDetails,
    openFeedPostDetails,
  };
}
