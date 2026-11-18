import type { Dispatch, SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function usePostDetailNavigation({
  setActivePostId,
}: {
  setActivePostId: Dispatch<SetStateAction<number | null>>;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  function openFeedPostDetails(id: number) {
    if (Number.isSafeInteger(id) && id > 0) setActivePostId(id);
  }

  function closeFeedPostDetails() {
    setActivePostId(null);
    const params = new URLSearchParams(location.search);
    params.delete("post");
    params.delete("tab");
    const isPostPath = location.pathname.startsWith("/feed/posts/");
    if (isPostPath && params.get("ref") === "share") params.delete("ref");
    if (isPostPath || new URLSearchParams(location.search).has("post")) {
      const returnTo = `/feed${params.size ? `?${params}` : ""}${location.hash}`;
      navigate(returnTo, { replace: true, state: location.state });
      return returnTo;
    }
  }

  return { closeFeedPostDetails, openFeedPostDetails };
}
