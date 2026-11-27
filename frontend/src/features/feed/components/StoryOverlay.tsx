import type { ApiRequest } from "@/shared/types/api";
import StoryViewer from "./StoryViewer";
import { type Story } from "../types";
import { useContext, useEffect, type SetStateAction } from "react";
import { SessionContext } from "../../../shared/context/SessionContext";
import { markStorySeen } from "../utils/storySeen";
import type { Dispatch } from "react";

export type StoryOverlayProps = {
  activeStory: Story;
  request: ApiRequest;
  deleteStory: (story: Story) => Promise<void>;
  name: string;
  openVisitor: (username: string) => void;
  openMessages: () => void;
  replyToStory: (story: Story, message: string) => Promise<boolean>;
  reportStory: (story: Story) => Promise<void>;
  setActiveStoryId: Dispatch<SetStateAction<number | null>>;
  shareStory: (story: Story) => Promise<void>;
  stories: Story[];
  storyBusy: boolean;
};

export default function StoryOverlay({
  activeStory,
  request,
  deleteStory,
  name,
  openVisitor,
  openMessages,
  replyToStory,
  reportStory,
  setActiveStoryId,
  shareStory,
  stories,
  storyBusy,
}: StoryOverlayProps) {
  const scope = useContext(SessionContext)?.session.sessionId;
  useEffect(() => {
    if (scope) markStorySeen(scope, activeStory.id);
  }, [scope, activeStory.id]);
  return (
      <StoryViewer
            activeStory={activeStory}
            request={request}
            stories={stories}
            name={name}
            storyBusy={storyBusy}
            deleteStory={deleteStory}
            setActiveStoryId={setActiveStoryId}
            onReply={replyToStory}
            onOpenMessages={() => {
              setActiveStoryId(null);
              openMessages();
            }}
            onProfile={(username) => {
              setActiveStoryId(null);
              openVisitor(username);
            }}
            onShare={(story) => void shareStory(story)}
            onReport={(story) => void reportStory(story)}
          />
  );
}