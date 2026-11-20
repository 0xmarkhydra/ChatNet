import { useCallback, useState, useRef, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { feedFilterFromSearch, feedFilterSearch, type FeedFilter } from "../utils/feedFilterRoute";
import { useScopedState } from "../../../shared/hooks/useScopedState";
import { type DiscussionDraft } from "../components/FeedDiscussion";
import type { Tab } from "../../../shared/types/navigation";
import type { StoryDraft } from "../types";

export type UseFeedUiStateDeps = {
  tab: Tab;
};

export function useFeedUiState({
  tab,
}: UseFeedUiStateDeps) {
  const [feedCommunitiesOpen, setFeedCommunitiesOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const feedFilter = tab === "feed" ? feedFilterFromSearch(location.search) : "all";
  // The URL is authoritative: Back/Forward and reload restore the selected tab.
  const setFeedFilter: Dispatch<SetStateAction<FeedFilter>> = useCallback((next) => {
    const value = typeof next === "function" ? next(feedFilter) : next;
    const pathname = tab === "feed" ? location.pathname : "/feed";
    const search = feedFilterSearch(tab === "feed" ? location.search : "", value);
    if (pathname === location.pathname && search === location.search) return;
    // If invoked from another page (Saved shortcut), replace the just-opened
    // Feed entry rather than adding an intermediate /feed history entry.
    navigate({ pathname, search }, { replace: tab !== "feed" });
  }, [feedFilter, tab, location.pathname, location.search, navigate]);
  // Ephemeral composer and check-in UI belongs to this tab visit. Scoped setters
  // also reject late callbacks from a previous visit, including feed → other → feed.
  const [feedComposerOpen, setFeedComposerOpen] = useScopedState(tab, false);
  const [feedCheckInOpen, setFeedCheckInOpen] = useScopedState(tab, false);
  const [feedCheckInLocation, setFeedCheckInLocation] = useScopedState(tab, "");
  const [storyDraft, setStoryDraft] = useScopedState<StoryDraft | null>(tab, null);
  const feedViewRef = useRef<HTMLDivElement>(null);
  const [searchHasScrolled, setSearchHasScrolled] = useState(false);
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [commentSortOrder, setCommentSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [commentEditors, setCommentEditors] = useState<
    Record<number, DiscussionDraft>
  >({});

  return {
    activePostId,
    activeStoryId,
    commentEditors,
    commentSortOrder,
    feedCheckInLocation,
    feedCheckInOpen,
    feedCommunitiesOpen,
    feedComposerOpen,
    feedFilter,
    feedViewRef,
    searchHasScrolled,
    setActivePostId,
    setActiveStoryId,
    setCommentEditors,
    setCommentSortOrder,
    setFeedCheckInLocation,
    setFeedCheckInOpen,
    setFeedCommunitiesOpen,
    setFeedComposerOpen,
    setFeedFilter,
    setSearchHasScrolled,
    setStoryBusy,
    setStoryDraft,
    storyBusy,
    storyDraft,
  };
}