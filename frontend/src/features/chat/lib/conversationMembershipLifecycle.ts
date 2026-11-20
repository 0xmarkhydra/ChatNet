import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ToastKind } from "../../../shared/utils/toast";
import type { Conversation, GroupMember, Message, MessageDraft } from "../types";

/**
 * Membership changes affect conversation visibility immediately, even if the
 * message cache has an older snapshot. Keep these operations outside App Shell
 * without changing the established realtime and notification contracts.
 */
export type MembershipRefs = {
  revokedConversationIds: RefObject<Set<number>>;
  membershipSnapshot: RefObject<Set<number> | null>;
  membershipEventSequence: RefObject<number>;
};

export type ConversationRevocationDeps = MembershipRefs & {
  responseCache: RefObject<{ invalidate: (keys: string[]) => unknown }>;
  activeConversationIdRef: RefObject<number | null>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setMessageDrafts: Dispatch<SetStateAction<Record<number, MessageDraft>>>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setHasMoreMessages: Dispatch<SetStateAction<boolean>>;
  setGroupMembers: Dispatch<SetStateAction<GroupMember[]>>;
  setGroupSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setSharedContentOpen: Dispatch<SetStateAction<boolean>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  setMessageActionId: Dispatch<SetStateAction<number | null>>;
  setNotice: (message: string, kind?: ToastKind) => void;
};

export function revokeConversationMembership(
  conversationId: number,
  deps: ConversationRevocationDeps,
) {
  deps.responseCache.current.invalidate(["conversations", "messages"]);
  window.dispatchEvent(new CustomEvent("chatnet:message-history-cleared", {
    detail: { conversationId },
  }));
  deps.revokedConversationIds.current.add(conversationId);
  deps.membershipSnapshot.current?.delete(conversationId);
  deps.membershipEventSequence.current += 1;
  deps.setConversations(current => current.filter(item => item.id !== conversationId));
  deps.setMessageDrafts(current => {
    const next = { ...current };
    delete next[conversationId];
    return next;
  });
  if (deps.activeConversationIdRef.current !== conversationId) return;

  deps.activeConversationIdRef.current = null;
  deps.setActiveConversationId(null);
  deps.setHasMoreMessages(false);
  deps.setGroupMembers([]);
  deps.setGroupSettingsOpen(false);
  deps.setSharedContentOpen(false);
  deps.setTranslations({});
  deps.setReplyingTo(null);
  deps.setMessageActionId(null);
  deps.setNotice("Bạn không còn là thành viên của nhóm này.");
}

export type NotificationConversationDeps = Pick<MembershipRefs, "revokedConversationIds" | "membershipSnapshot"> & {
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  switchTab: (tab: "chat") => void;
  selectConversation: (id: number) => void;
};

export function restoreConversationFromNotification(
  conversation: Conversation,
  deps: NotificationConversationDeps,
) {
  deps.revokedConversationIds.current.delete(conversation.id);
  deps.membershipSnapshot.current?.add(conversation.id);
  deps.setConversations(current => [
    conversation,
    ...current.filter(item => item.id !== conversation.id),
  ]);
  deps.switchTab("chat");
  deps.selectConversation(conversation.id);
}

export type MembershipLogoutDeps = MembershipRefs & {
  membershipSyncSequence: RefObject<number>;
};

export function resetConversationMembershipOnLogout(deps: MembershipLogoutDeps) {
  deps.revokedConversationIds.current.clear();
  deps.membershipSnapshot.current = null;
  // Invalidate all previous async membership snapshots and realtime events.
  deps.membershipSyncSequence.current += 1;
  deps.membershipEventSequence.current += 1;
}
