// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../types";
import { useChatQuickSelectionActions } from "./useChatQuickSelectionActions";
import type { ChatQuickContact, ChatQuickHit } from "./useChatQuickSearch";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

const conversation = (id: number) => ({
  id, type: "direct", name: "Friend", memberCount: 2, unreadCount: 0,
  lastMessage: "", online: false, createdAt: "2026-11-20T00:00:00Z",
}) as Conversation;

function mountQuickActions() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const select = vi.fn();
  const openDirect = vi.fn();
  let snapshot!: {
    conversations: Conversation[];
    quickOpen: boolean;
    keyword: string;
    jump: { conversationId: number; messageId: number; revision: number } | null;
    translations: Record<number, string>;
    originals: Record<number, boolean>;
    actions: ReturnType<typeof useChatQuickSelectionActions>;
  };
  function Probe() {
    const [conversations, setConversations] = useState<Conversation[]>([conversation(1)]);
    const [quickOpen, setQuickSearchOpen] = useState(true);
    const [keyword, setGlobalSearch] = useState("hello");
    const [jump, setChatSearchJump] = useState<{ conversationId: number; messageId: number; revision: number } | null>(null);
    const [translations, setTranslations] = useState<Record<number, string>>({ 1: "translated" });
    const [originals, setTranslationOriginals] = useState<Record<number, boolean>>({ 1: true });
    const revision = useRef(0);
    const actions = useChatQuickSelectionActions({
      setQuickSearchOpen, setGlobalSearch, setChatSearchJump, setConversations,
      selectConversation: select, openDirectByUsername: openDirect, nextRevision: () => ++revision.current,
      setTranslations, setTranslationOriginals,
    });
    snapshot = { conversations, quickOpen, keyword, jump, translations, originals, actions };
    return null;
  }
  act(() => root.render(<Probe />));
  cleanups.push(() => { act(() => root.unmount()); host.remove(); });
  return { get state() { return snapshot; }, select, openDirect };
}

describe("useChatQuickSelectionActions", () => {
  it("selects an existing conversation without duplication and clears previous jump", () => {
    const app = mountQuickActions();
    const contact: ChatQuickContact = { id: 2, name: "Friend", conversation: conversation(1) };
    act(() => app.state.actions.openChatQuickContact(contact));
    expect(app.state.conversations.map(item => item.id)).toEqual([1]);
    expect(app.state.quickOpen).toBe(false);
    expect(app.state.keyword).toBe("");
    expect(app.state.jump).toBeNull();
    expect(app.select).toHaveBeenCalledWith(1);
  });
  it("opens username-only contact without creating a conversation", () => {
    const app = mountQuickActions();
    act(() => app.state.actions.openChatQuickContact({ id: 3, name: "Friend", username: "friend" }));
    expect(app.openDirect).toHaveBeenCalledWith("friend");
    expect(app.select).not.toHaveBeenCalled();
    expect(app.state.conversations).toHaveLength(1);
  });
  it("appends a new hit conversation and advances jump revision on repeated selection", () => {
    const app = mountQuickActions();
    const hit: ChatQuickHit = { id: 48, conversation: conversation(8), sender: "friend", text: "hello", createdAt: "2026-11-20T00:00:00Z" };
    act(() => app.state.actions.openChatQuickHit(hit));
    expect(app.state.conversations.map(item => item.id)).toEqual([1, 8]);
    expect(app.state.jump).toEqual({ conversationId: 8, messageId: 48, revision: 1 });
    expect(app.state.translations).toEqual({});
    expect(app.state.originals).toEqual({});
    act(() => app.state.actions.openChatQuickHit(hit));
    expect(app.state.conversations).toHaveLength(2);
    expect(app.state.jump?.revision).toBe(2);
    expect(app.select).toHaveBeenCalledTimes(2);
  });
});
