import { useRef, useState } from "react";
import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import type { Tab } from "../../../shared/types/navigation";
import type { MediaAttachment } from "../../../shared/utils/media";
import type { FriendConnection } from "../../contacts/types";
import { patchPost, submitPost } from "../api/posts";
import type { Post } from "../types";
import { composePostContent, parsePostExtras } from "../utils/postExtras";

export type TaggedFriend = { id: number; username: string; displayName: string };

export type PostDraftSnapshot = {
  text: string;
  tags: TaggedFriend[];
  feelingId: string;
  visibility: "public" | "friends" | "private";
  background: string;
  showBackgrounds: boolean;
  attachments: MediaAttachment[];
  checkInOpen: boolean;
  location: string;
};

export type UsePostComposerDeps = {
  actionLocks: RefObject<Set<string>>;
  feedCheckInLocation: string;
  feedCheckInOpen: boolean;
  feedRevisionRef: RefObject<number>;
  friends: FriendConnection[];
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  name: string;
  pendingPost: Post | null;
  setFeedCheckInLocation: Dispatch<SetStateAction<string>>;
  setFeedCheckInOpen: Dispatch<SetStateAction<boolean>>;
  setFeedComposerOpen: Dispatch<SetStateAction<boolean>>;
  setPendingPost: Dispatch<SetStateAction<Post | null>>;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setPostSubmitError: Dispatch<SetStateAction<string>>;
  setProfileComposerOpen: Dispatch<SetStateAction<boolean>>;
  setProfilePosts: Dispatch<SetStateAction<Post[]>>;
  syncFeedPost: (updated: Post) => void;
  tab: Tab;
};

/** Owns the post draft (text, tags, feeling, audience, media) and publishes or edits a post. */
export function usePostComposer({
  actionLocks,
  feedCheckInLocation,
  feedCheckInOpen,
  feedRevisionRef,
  friends,
  mediaUploading,
  name,
  pendingPost,
  setFeedCheckInLocation,
  setFeedCheckInOpen,
  setFeedComposerOpen,
  setPendingPost,
  setPosts,
  setPostSubmitError,
  setProfileComposerOpen,
  setProfilePosts,
  syncFeedPost,
  tab,
}: UsePostComposerDeps) {
  const { session, sessionRef } = useSession();
  const { apiFetch } = useApi();
  const { setNotice } = useNotice();
  const [postText, setPostText] = useState("");
  const [postTaggedFriends, setPostTaggedFriends] = useState<TaggedFriend[]>([]);
  const [postFeelingId, setPostFeelingId] = useState("");
  const [postVisibility, setPostVisibility] = useState<
    "public" | "friends" | "private"
  >("public");
  const [postBackground, setPostBackground] = useState("");
  const [showPostBackgrounds, setShowPostBackgrounds] = useState(false);
  const [postAttachments, setPostAttachments] = useState<MediaAttachment[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [postEditBusy, setPostEditBusy] = useState(false);
  const draftBeforeEdit = useRef<PostDraftSnapshot | null>(null);
  function openEditPost(post: Post) {
      if (post.author !== name || pendingPost || postEditBusy || mediaUploading) return;
      const extras = parsePostExtras(post.content);
      draftBeforeEdit.current = {
        text: postText,
        tags: [...postTaggedFriends],
        feelingId: postFeelingId,
        visibility: postVisibility,
        background: postBackground,
        showBackgrounds: showPostBackgrounds,
        attachments: [...postAttachments],
        checkInOpen: feedCheckInOpen,
        location: feedCheckInLocation,
      };
      setEditingPost(post);
      setPostSubmitError("");
      setPostText(extras.caption);
      setPostTaggedFriends(extras.taggedUsernames.map((username, index) => {
        const friend = friends.find(item => item.username === username);
        return { id: friend?.id ?? -(index + 1), username,
          displayName: friend?.displayName || username };
      }));
      setPostFeelingId(extras.feelingId);
      setFeedCheckInLocation(extras.location);
      setFeedCheckInOpen(Boolean(extras.location));
      setPostVisibility(post.visibility || "public");
      setPostBackground(post.background || "");
      setShowPostBackgrounds(false);
      setPostAttachments(post.attachments || []);
      if (tab === "profile") setProfileComposerOpen(true);
      else setFeedComposerOpen(true);
    }
  function restoreDraftAfterEdit() {
      const previous = draftBeforeEdit.current;
      if (previous) {
        setPostText(previous.text);
        setPostTaggedFriends(previous.tags);
        setPostFeelingId(previous.feelingId);
        setPostVisibility(previous.visibility);
        setPostBackground(previous.background);
        setShowPostBackgrounds(previous.showBackgrounds);
        setPostAttachments(previous.attachments);
        setFeedCheckInOpen(previous.checkInOpen);
        setFeedCheckInLocation(previous.location);
      }
      draftBeforeEdit.current = null;
      setEditingPost(null);
      setPostSubmitError("");
    }
  async function createPost(event: FormEvent) {
      event.preventDefault();
      if (
        !session ||
        actionLocks.current.has("feed:create") ||
        postEditBusy ||
        mediaUploading ||
        (!postText.trim() &&
          postAttachments.length === 0 &&
          postTaggedFriends.length === 0 &&
          !postFeelingId &&
          !(feedCheckInOpen && feedCheckInLocation.trim()))
      )
        return;

      setPostSubmitError("");
      if (feedCheckInOpen && !feedCheckInLocation.trim()) {
        setPostSubmitError("Vui lòng nhập địa điểm check-in.");
        return;
      }
      const locationText = feedCheckInOpen ? feedCheckInLocation.trim() : "";
      const content = composePostContent({
        caption: postText,
        location: locationText,
        taggedUsernames: postTaggedFriends.map(friend => friend.username),
        feelingId: postFeelingId,
      });
      if (Array.from(content).length > 5000) {
        setPostSubmitError("Nội dung và địa điểm vượt quá 5.000 ký tự.");
        return;
      }
      const attachments = postAttachments;
      const visibility = postVisibility;
      const background = postBackground;
      const sessionId = session.sessionId;
      if (editingPost) {
        const key = `feed:edit:${editingPost.id}`;
        if (actionLocks.current.has(key)) return;
        actionLocks.current.add(key);
        setPostEditBusy(true);
        try {
          const response = await patchPost(apiFetch, editingPost.id, { content, visibility, background });
          const updated = await response.json().catch(() => null) as (Post & { error?: string }) | null;
          if (sessionRef.current?.sessionId !== sessionId) return;
          if (!response.ok || !updated || updated.id !== editingPost.id) {
            throw new Error(updated?.error || "Không cập nhật được bài viết.");
          }
          syncFeedPost(updated);
          restoreDraftAfterEdit();
          setFeedComposerOpen(false);
          setProfileComposerOpen(false);
          setNotice("Đã cập nhật bài viết.", "success");
        } catch (error) {
          if (sessionRef.current?.sessionId === sessionId) {
            setPostSubmitError(error instanceof Error ? error.message : "Không cập nhật được bài viết.");
          }
        } finally {
          actionLocks.current.delete(key);
          if (sessionRef.current?.sessionId === sessionId) setPostEditBusy(false);
        }
        return;
      }
      actionLocks.current.add("feed:create");
      ++feedRevisionRef.current;
      setPendingPost({
        id: -1,
        author: name,
        authorDisplayName: session?.user.displayName,
        content,
        visibility,
        background,
        attachments,
        likes: 0,
        liked: false,
        comments: [],
        createdAt: new Date().toISOString(),
      });
      try {
        const response = await submitPost(apiFetch, { content, attachments, visibility, background });
        const post = (await response.json()) as Post & { error?: string };
        if (sessionRef.current?.sessionId !== sessionId) return;
        if (!response.ok || !Number.isSafeInteger(post.id) || post.id <= 0)
          throw new Error(post.error || "Không đăng được bài viết");
        setPosts((current) => [
          post,
          ...current.filter((item) => item.id !== post.id),
        ]);
        setProfilePosts((current) => [
          post,
          ...current.filter((item) => item.id !== post.id),
        ]);
        setPostText("");
        setPostTaggedFriends([]);
        setPostFeelingId("");
        setPostAttachments([]);
        setPostBackground("");
        setShowPostBackgrounds(false);
        setProfileComposerOpen(false);
        setFeedComposerOpen(false);
        setFeedCheckInOpen(false);
        setFeedCheckInLocation("");
        setNotice("Đã đăng bài viết.", "success");
      } catch (error) {
        if (sessionRef.current?.sessionId === sessionId) {
          const message =
            error instanceof Error
              ? error.message
              : "Không đăng được bài viết. Bản nháp được giữ lại.";
          setPostSubmitError(message);
          setNotice(message, "error");
        }
      } finally {
        if (sessionRef.current?.sessionId === sessionId) {
          ++feedRevisionRef.current;
          actionLocks.current.delete("feed:create");
          setPendingPost(null);
        }
      }
    }

  return {
    createPost,
    draftBeforeEdit,
    editingPost,
    openEditPost,
    postAttachments,
    postBackground,
    postEditBusy,
    postFeelingId,
    postTaggedFriends,
    postText,
    postVisibility,
    restoreDraftAfterEdit,
    setEditingPost,
    setPostAttachments,
    setPostBackground,
    setPostEditBusy,
    setPostFeelingId,
    setPostTaggedFriends,
    setPostText,
    setPostVisibility,
    setShowPostBackgrounds,
    showPostBackgrounds,
  };
}
