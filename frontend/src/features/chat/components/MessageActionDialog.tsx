import MessageActions from "./MessageActions";
import { type Message } from "../types";
import { type MessageCopyTarget } from "../utils/messageCopyTarget";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import type { PinnedMessage } from "../types";
import type { Dispatch } from "react";

export type MessageActionDialogProps = {
  activeMessageAction: Message;
  copyMessageContent: (message: Message, target: MessageCopyTarget) => Promise<void>;
  editOwnMessage: (message: Message) => Promise<void>;
  messageActionMode: "reactions" | "actions";
  messageCopyTarget: MessageCopyTarget | null;
  pinnedMessages: PinnedMessage[];
  recallOwnMessage: (message: Message) => Promise<void>;
  session: Session;
  setMessageActionId: Dispatch<SetStateAction<number | null>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  toggleMessagePin: (message: Message) => Promise<void>;
  toggleReaction: (message: Message, emoji: string) => Promise<void>;
  translateMessage: (message: Message, reveal?: boolean) => Promise<void>;
};

export default function MessageActionDialog({
  activeMessageAction,
  copyMessageContent,
  editOwnMessage,
  messageActionMode,
  messageCopyTarget,
  pinnedMessages,
  recallOwnMessage,
  session,
  setMessageActionId,
  setReplyingTo,
  toggleMessagePin,
  toggleReaction,
  translateMessage,
}: MessageActionDialogProps) {
  return (
      <MessageActions
            mode={messageActionMode}
            activeMessageAction={activeMessageAction}
            userId={session.user.id}
            isPinned={pinnedMessages.some((pin) => pin.message.id === activeMessageAction.id)}
            toggleMessagePin={toggleMessagePin}
            setMessageActionId={setMessageActionId}
            toggleReaction={toggleReaction}
            setReplyingTo={setReplyingTo}
            copyTarget={messageCopyTarget}
            copyMessageContent={copyMessageContent}
            translateMessage={translateMessage}
            editOwnMessage={editOwnMessage}
            recallOwnMessage={recallOwnMessage}
          />
  );
}
