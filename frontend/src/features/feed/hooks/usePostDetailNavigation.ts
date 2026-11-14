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

/** Keep post detail URLs in React Router history (including Desktop HashRouter). */
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
    if (tab === "feed" && isProfileDesktop) {
      feedScrollBeforeCommentsRef.current = feedViewRef.current?.scrollTop ?? 0;
      const params = new URLSearchParams(location.search);
      if (params.get("post") !== String(id)) {
        params.set("tab", "feed");
        params.set("post", String(id));
        navigate(
          { pathname: location.pathname, search: `?${params}`, hash: location.hash },
          { state: { ...(location.state ?? {}), postId: id } },
        );
      }
    }
    setActivePostId(id);
  }

  function closeFeedPostDetails() {
    setActivePostId(null);
    const params = new URLSearchParams(location.search);
    if (params.has("post")) {
      params.delete("post");
      navigate(
        { pathname: location.pathname, search: params.size ? `?${params}` : "", hash: location.hash },
        { replace: true, state: location.state },
      );
    }
  }

  return { closeFeedPostDetails, openFeedPostDetails };
}
