import ProfileOverlay from "../../profile/components/ProfileOverlay";
import StoryComposer from "./StoryComposer";
import type { Dispatch, SetStateAction } from "react";

export type StoryDraftOverlayProps = {
  storyDraftFile: File;
  busy: boolean;
  createStory: (file?: File) => Promise<void>;
  setStoryDraftFile: Dispatch<SetStateAction<File | null>>;
};

export default function StoryDraftOverlay({
  storyDraftFile,
  busy,
  createStory,
  setStoryDraftFile,
}: StoryDraftOverlayProps) {
  return (
    <ProfileOverlay title="Tạo Story" busy={busy} onClose={() => setStoryDraftFile(null)}>
      <StoryComposer file={storyDraftFile} busy={busy}
        onPublish={() => void createStory(storyDraftFile)}
        onChangeFile={setStoryDraftFile} />
    </ProfileOverlay>
  );
}
