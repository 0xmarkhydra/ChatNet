import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { type DiscussionDraft } from "../components/FeedDiscussion";
import { type MediaAttachment } from "../../../shared/utils/media";
import { type Post } from "../types";
import type { Tab } from "../../../app/types";

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
  const [storyDraftFile, setStoryDraftFile] = useState<File | null>(null);
  const [commentEditors, setCommentEditors] = useState<
    Record<number, DiscussionDraft>
  >({});
  const [postText, setPostText] = useState("");
  const [postTaggedFriends, setPostTaggedFriends] = useState<Array<{ id: number; username: string; displayName: string }>>([]);
  const [postFeelingId, setPostFeelingId] = useState("");
  const [postVisibility, setPostVisibility] = useState<
    "public" | "friends" | "private"
  >("public");
  const [postBackground, setPostBackground] = useState("");
  const [showPostBackgrounds, setShowPostBackgrounds] = useState(false);
  const [postAttachments, setPostAttachments] = useState<MediaAttachment[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [postEditBusy, setPostEditBusy] = useState(false);
  const draftBeforeEdit = useRef<{
    text: string;
    tags: typeof postTaggedFriends;
    feelingId: string;
    visibility: typeof postVisibility;
    background: string;
    showBackgrounds: boolean;
    attachments: MediaAttachment[];
    checkInOpen: boolean;
    location: string;
  } | null>(null);

  return {
    activePostId,
    activeStoryId,
    commentEditors,
    commentSortOrder,
    draftBeforeEdit,
    editingPost,
    feedCheckInLocation,
    feedCheckInOpen,
    feedCommunitiesOpen,
    feedComposerOpen,
    feedFilter,
    feedScrollBeforeComments,
    feedViewRef,
    postAttachments,
    postBackground,
    postEditBusy,
    postFeelingId,
    postTaggedFriends,
    postText,
    postVisibility,
    searchHasScrolled,
    setActivePostId,
    setActiveStoryId,
    setCommentEditors,
    setCommentSortOrder,
    setEditingPost,
    setFeedCheckInLocation,
    setFeedCheckInOpen,
    setFeedCommunitiesOpen,
    setFeedComposerOpen,
    setFeedFilter,
    setPostAttachments,
    setPostBackground,
    setPostEditBusy,
    setPostFeelingId,
    setPostTaggedFriends,
    setPostText,
    setPostVisibility,
    setSearchHasScrolled,
    setShowPostBackgrounds,
    setStoryBusy,
    setStoryDraftFile,
    showPostBackgrounds,
    storyBusy,
    storyDraftFile,
  };
}
