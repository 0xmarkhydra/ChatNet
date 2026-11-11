import StoryViewer from "./StoryViewer";
import { type Story } from "../types";
import { type SetStateAction } from "react";
import type { Dispatch } from "react";

export type StoryOverlayProps = {
  activeStory: Story;
  deleteStory: (story: Story) => Promise<void>;
  name: string;
  openVisitor: (username: string) => void;
  replyToStory: (story: Story, message: string) => Promise<boolean>;
  reportStory: (story: Story) => Promise<void>;
  setActiveStoryId: Dispatch<SetStateAction<number | null>>;
  shareStory: (story: Story) => Promise<void>;
  stories: Story[];
  storyBusy: boolean;
};

export default function StoryOverlay({
  activeStory,
  deleteStory,
  name,
  openVisitor,
  replyToStory,
  reportStory,
  setActiveStoryId,
  shareStory,
  stories,
  storyBusy,
}: StoryOverlayProps) {
  return (
      <StoryViewer
            activeStory={activeStory}
            stories={stories}
            name={name}
            storyBusy={storyBusy}
            deleteStory={deleteStory}
            setActiveStoryId={setActiveStoryId}
            onReply={replyToStory}
            onProfile={(username) => {
              setActiveStoryId(null);
              openVisitor(username);
            }}
            onShare={(story) => void shareStory(story)}
            onReport={(story) => void reportStory(story)}
          />
  );
}
