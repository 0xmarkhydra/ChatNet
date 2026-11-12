import ProfileOverlay from "../../profile/components/ProfileOverlay";
import { type Post } from "../types";
import { type SetStateAction } from "react";
import type { Dispatch, ReactNode } from "react";

export type FeedComposerOverlayProps = {
  editingPost: Post | null;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  pendingPost: Post | null;
  postComposer: ReactNode;
  postEditBusy: boolean;
  restoreDraftAfterEdit: () => void;
  setFeedCheckInOpen: Dispatch<SetStateAction<boolean>>;
  setFeedComposerOpen: Dispatch<SetStateAction<boolean>>;
};

export default function FeedComposerOverlay({
  editingPost,
  mediaUploading,
  pendingPost,
  postComposer,
  postEditBusy,
  restoreDraftAfterEdit,
  setFeedCheckInOpen,
  setFeedComposerOpen,
}: FeedComposerOverlayProps) {
  return (
      <ProfileOverlay
          title={editingPost ? "Chỉnh sửa bài viết" : "Tạo bài viết"}
          busy={!!pendingPost || postEditBusy || mediaUploading === "feed"}
          onClose={() => {
            setFeedComposerOpen(false);
            if (editingPost) restoreDraftAfterEdit();
            else setFeedCheckInOpen(false);
          }}
        >
          {postComposer}
        </ProfileOverlay>
  );
}
