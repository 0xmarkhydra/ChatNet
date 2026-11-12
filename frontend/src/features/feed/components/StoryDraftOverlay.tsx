import ProfileOverlay from "../../profile/components/ProfileOverlay";
import StoryComposer from "./StoryComposer";
import { type SetStateAction } from "react";
import type { Dispatch } from "react";

export type StoryDraftOverlayProps = {
  createStory: (file?: File) => Promise<void>;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  setStoryDraftFile: Dispatch<SetStateAction<File | null>>;
  storyBusy: boolean;
  storyDraftFile: File;
};

export default function StoryDraftOverlay({
  createStory,
  mediaUploading,
  setStoryDraftFile,
  storyBusy,
  storyDraftFile,
}: StoryDraftOverlayProps) {
  return (
      <ProfileOverlay title="Tạo Story" busy={storyBusy || mediaUploading === "story"}
          onClose={() => setStoryDraftFile(null)}>
          <StoryComposer file={storyDraftFile} busy={storyBusy || mediaUploading === "story"}
            onPublish={() => void createStory(storyDraftFile)}
            onChangeFile={setStoryDraftFile} />
        </ProfileOverlay>
  );
}
