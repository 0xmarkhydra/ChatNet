import ProfileOverlay from "./ProfileOverlay";
import { type Post } from "../../feed/types";
import { type SetStateAction } from "react";
import type { Dispatch, ReactNode } from "react";

export type ProfileComposerOverlayProps = {
  editingPost: Post | null;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  pendingPost: Post | null;
  postComposer: ReactNode;
  postEditBusy: boolean;
  restoreDraftAfterEdit: () => void;
  setProfileComposerOpen: Dispatch<SetStateAction<boolean>>;
};

export default function ProfileComposerOverlay({
  editingPost,
  mediaUploading,
  pendingPost,
  postComposer,
  postEditBusy,
  restoreDraftAfterEdit,
  setProfileComposerOpen,
}: ProfileComposerOverlayProps) {
  return (
      <ProfileOverlay
            title={editingPost ? "Chỉnh sửa bài viết" : "Tạo bài viết"}
            busy={!!pendingPost || postEditBusy || mediaUploading === "feed"}
            onClose={() => {
              setProfileComposerOpen(false);
              if (editingPost) restoreDraftAfterEdit();
            }}
          >
            {postComposer}
          </ProfileOverlay>
  );
}
