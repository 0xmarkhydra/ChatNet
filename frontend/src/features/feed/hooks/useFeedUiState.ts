import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { type DiscussionDraft } from "../components/FeedDiscussion";
import type { Tab } from "../../../shared/types/navigation";

export type UseFeedUiStateDeps = {
  tab: Tab;
};

export function useFeedUiState({
  tab,
}: UseFeedUiStateDeps) {
  const [feedCommunitiesOpen, setFeedCommunitiesOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<
    "all" | "following" | "latest" | "saved"
  >("all");
  const [feedComposerOpen, setFeedComposerOpen] = useState(false);
  const [feedCheckInOpen, setFeedCheckInOpen] = useState(false);
  const [feedCheckInLocation, setFeedCheckInLocation] = useState("");
  const [storyDraftFile, setStoryDraftFile] = useState<File | null>(null);
  useEffect(() => {
    if (tab !== "feed") {
      setFeedComposerOpen(false);
      setFeedCheckInOpen(false);
      setFeedCheckInLocation("");
      setStoryDraftFile(null);
    }
  }, [tab]);
  const feedViewRef = useRef<HTMLDivElement>(null);
  const [searchHasScrolled, setSearchHasScrolled] = useState(false);
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [commentSortOrder, setCommentSortOrder] = useState<'newest' | 'oldest'>('newest');
  const feedScrollBeforeComments = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (tab === "feed" && activePostId === null && feedScrollBeforeComments.current !== null && feedViewRef.current) {
      feedViewRef.current.scrollTop = feedScrollBeforeComments.current;
      feedScrollBeforeComments.current = null;
    }
  }, [activePostId, tab]);
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
    feedScrollBeforeComments,
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
    setStoryDraftFile,
    storyBusy,
    storyDraftFile,
  };
}
