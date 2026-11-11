import ProfileOverlay from "../profile/ProfileOverlay";
import { type Post } from "./types";
import { type SetStateAction } from "react";
import type { Dispatch, ReactNode } from "react";

export type FeedComposerOverlayProps = {
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  pendingPost: Post | null;
  postComposer: ReactNode;
  setFeedCheckInOpen: Dispatch<SetStateAction<boolean>>;
  setFeedComposerOpen: Dispatch<SetStateAction<boolean>>;
};

export default function FeedComposerOverlay({
  mediaUploading,
  pendingPost,
  postComposer,
  setFeedCheckInOpen,
  setFeedComposerOpen,
}: FeedComposerOverlayProps) {
  return (
      <ProfileOverlay
          title="Tạo bài viết"
          busy={!!pendingPost || mediaUploading === "feed"}
          onClose={() => {
            setFeedComposerOpen(false);
            setFeedCheckInOpen(false);
          }}
        >
          {postComposer}
        </ProfileOverlay>
  );
}
