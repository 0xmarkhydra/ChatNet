// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetStateAction } from "react";
import type { Conversation, Message, MessageDraft, GroupMember } from "../types";
import {
  revokeConversationMembership,
  restoreConversationFromNotification,
  resetConversationMembershipOnLogout,
  type ConversationRevocationDeps,
} from "./conversationMembershipLifecycle";

const conversation = (id: number) => ({
  id, type: "group", name: `Group ${id}`, unreadCount: 0,
  memberCount: 3, lastMessage: "", online: false, createdAt: "",
}) as Conversation;

function state<T>(initial: T) {
  let value = initial;
  const setter = vi.fn((change: SetStateAction<T>) => {
    value = typeof change === "function" ? (change as (current: T) => T)(value) : change;
  });
  return { get current() { return value; }, setter };
}
function fixture(active: number | null) {
  const conversations = state([conversation(2), conversation(3)]);
  const drafts = state<Record<number, MessageDraft>>({
    2: { text: "private", attachments: [] },
    3: { text: "keep", attachments: [] },
  });
  const activeId = state(active);
  const hasMore = state(true);
  const members = state<GroupMember[]>([{ id: 8 } as GroupMember]);
  const groupOpen = state(true);
  const sharedOpen = state(true);
  const translations = state<Record<number, string>>({ 55: "hello" });
  const reply = state<Message | null>({ id: 55 } as Message);
  const action = state<number | null>(55);
  const notice = vi.fn();
  const invalidate = vi.fn();
  const refs = {
    revokedConversationIds: { current: new Set<number>() },
    membershipSnapshot: { current: new Set([2, 3]) as Set<number> | null },
    membershipEventSequence: { current: 10 },
    membershipSyncSequence: { current: 20 },
  };
  const deps: ConversationRevocationDeps = {
    ...refs,
    responseCache: { current: { invalidate } },
    activeConversationIdRef: { current: active },
    setConversations: conversations.setter,
    setMessageDrafts: drafts.setter,
    setActiveConversationId: activeId.setter,
    setHasMoreMessages: hasMore.setter,
    setGroupMembers: members.setter,
    setGroupSettingsOpen: groupOpen.setter,
    setSharedContentOpen: sharedOpen.setter,
    setTranslations: translations.setter,
    setReplyingTo: reply.setter,
    setMessageActionId: action.setter,
    setNotice: notice,
  };
  return {
    deps, refs, conversations, drafts, activeId, hasMore, members,
    groupOpen, sharedOpen, translations, reply, action, notice, invalidate,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("conversation membership lifecycle", () => {
  it("removes only the revoked conversation and draft, preserving the active room", () => {
    const f = fixture(3);
    const events: number[] = [];
    const onCleared = (event: Event) => events.push((event as CustomEvent<{ conversationId: number }>).detail.conversationId);
    window.addEventListener("chatnet:message-history-cleared", onCleared);
    try {
      revokeConversationMembership(2, f.deps);
    } finally {
      window.removeEventListener("chatnet:message-history-cleared", onCleared);
    }
    expect(f.conversations.current.map(c => c.id)).toEqual([3]);
    expect(Object.keys(f.drafts.current)).toEqual(["3"]);
    expect(f.refs.revokedConversationIds.current.has(2)).toBe(true);
    expect(f.refs.membershipSnapshot.current?.has(2)).toBe(false);
    expect(f.refs.membershipEventSequence.current).toBe(11);
    expect(f.activeId.current).toBe(3);
    expect(f.groupOpen.current).toBe(true);
    expect(f.notice).not.toHaveBeenCalled();
    expect(f.invalidate).toHaveBeenCalledWith(["conversations", "messages"]);
    expect(events).toEqual([2]);
  });

  it("closes sensitive panels and messages when the active membership is revoked", () => {
    const f = fixture(2);
    revokeConversationMembership(2, f.deps);
    expect(f.activeId.current).toBeNull();
    expect(f.deps.activeConversationIdRef.current).toBeNull();
    expect(f.hasMore.current).toBe(false);
    expect(f.members.current).toEqual([]);
    expect(f.groupOpen.current).toBe(false);
    expect(f.sharedOpen.current).toBe(false);
    expect(f.translations.current).toEqual({});
    expect(f.reply.current).toBeNull();
    expect(f.action.current).toBeNull();
    expect(f.notice).toHaveBeenCalledOnce();
  });

  it("notification admission restores membership without duplicate conversations", () => {
    const f = fixture(3);
    f.refs.revokedConversationIds.current.add(2);
    f.refs.membershipSnapshot.current?.delete(2);
    const switchTab = vi.fn();
    const selectConversation = vi.fn();
    restoreConversationFromNotification(conversation(2), {
      ...f.refs,
      setConversations: f.conversations.setter,
      switchTab,
      selectConversation,
    });
    expect(f.refs.revokedConversationIds.current.has(2)).toBe(false);
    expect(f.refs.membershipSnapshot.current?.has(2)).toBe(true);
    expect(f.conversations.current.map(c => c.id)).toEqual([2, 3]);
    expect(switchTab).toHaveBeenCalledWith("chat");
    expect(selectConversation).toHaveBeenCalledWith(2);
  });

  it("logout invalidates outstanding membership scans and realtime revisions", () => {
    const f = fixture(2);
    f.refs.revokedConversationIds.current.add(2);
    resetConversationMembershipOnLogout(f.refs);
    expect([...f.refs.revokedConversationIds.current]).toEqual([]);
    expect(f.refs.membershipSnapshot.current).toBeNull();
    expect(f.refs.membershipSyncSequence.current).toBe(21);
    expect(f.refs.membershipEventSequence.current).toBe(11);
  });
});
