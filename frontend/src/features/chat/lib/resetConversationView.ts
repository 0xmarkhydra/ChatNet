import type { Dispatch, RefObject, SetStateAction } from "react";
import type { GroupMember } from "../types";

export type ConversationViewResetTargets = {
  activeConversationIdRef: RefObject<number | null>;
  messageScrollAtBottom: RefObject<boolean>;
  messagesPagingBusy: RefObject<boolean>;
  setHasMoreMessages: Dispatch<SetStateAction<boolean>>;
  setMessagesLoadingMore: Dispatch<SetStateAction<boolean>>;
  setGroupMembers: Dispatch<SetStateAction<GroupMember[]>>;
};

/** Reset transient UI and paging flags, without discarding cached messages or drafts. */
export function resetConversationView(conversationId: number | null, targets: ConversationViewResetTargets) {
  targets.activeConversationIdRef.current = conversationId;
  targets.messageScrollAtBottom.current = true;
  targets.setHasMoreMessages(false);
  targets.setMessagesLoadingMore(false);
  targets.messagesPagingBusy.current = false;
  targets.setGroupMembers([]);
}
