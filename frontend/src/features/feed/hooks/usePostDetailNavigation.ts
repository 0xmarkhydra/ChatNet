import type { Dispatch, RefObject, SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Tab } from "../../../shared/types/navigation";

export type UsePostDetailNavigationDeps = {
  feedScrollBeforeComments: RefObject<number | null>;
  feedViewRef: RefObject<HTMLDivElement | null>;
  isProfileDesktop: boolean;
  setActivePostId: Dispatch<SetStateAction<number | null>>;
  tab: Tab;
};

/** Shareable post details use the same route on desktop, mobile and Desktop HashRouter. */
export function usePostDetailNavigation({
  feedScrollBeforeComments: feedScrollBeforeCommentsRef,
  feedViewRef,
  isProfileDesktop,
  setActivePostId,
  tab,
}: UsePostDetailNavigationDeps) {
  const location = useLocation();
  const navigate = useNavigate();

  function openFeedPostDetails(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    if (tab === "feed" && isProfileDesktop) {
      feedScrollBeforeCommentsRef.current = feedViewRef.current?.scrollTop ?? 0;
    }
    const path = `/feed/posts/${id}`;
    if (tab === "feed" && location.pathname !== path) {
      const params = new URLSearchParams(location.search);
      params.delete("post");
      params.delete("tab");
      navigate(
        { pathname: path, search: params.size ? `?${params}` : "", hash: location.hash },
        { state: { ...(location.state ?? {}), postId: id } },
      );
    }
    setActivePostId(id);
  }

  function closeFeedPostDetails() {
    setActivePostId(null);
    const params = new URLSearchParams(location.search);
    params.delete("post");
    params.delete("tab");
    if (location.pathname.startsWith("/feed/posts/") || new URLSearchParams(location.search).has("post")) {
      navigate(
        { pathname: "/feed", search: params.size ? `?${params}` : "", hash: location.hash },
        { replace: true, state: location.state },
      );
    }
  }

  return { closeFeedPostDetails, openFeedPostDetails };
}
