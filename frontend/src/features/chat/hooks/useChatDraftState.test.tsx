// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { Session } from "../../../shared/types/session";
import { useChatDraftState } from "./useChatDraftState";

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
const hosts: Array<{ host: HTMLDivElement; unmount: () => void }> = [];

afterEach(() => {
  while (hosts.length) {
    const item = hosts.pop()!;
    act(item.unmount);
    item.host.remove();
  }
  sessionStorage.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
});

type DraftState = ReturnType<typeof useChatDraftState>;

function mountDrafts(userId = 21) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  hosts.push({ host, unmount: () => root.unmount() });
  let current!: DraftState;
  function Probe({ conversationId, channelId }: { conversationId: number; channelId: number }) {
    const sessionRef = useRef({ user: { id: userId } } as Session);
    current = useChatDraftState({
      userId, sessionRef, activeConversationId: conversationId, selectedChannelId: channelId,
    });
    return null;
  }
  const render = (conversationId: number, channelId = 0) => {
    act(() => root.render(<Probe conversationId={conversationId} channelId={channelId} />));
    return current;
  };
  return { render };
}

describe("useChatDraftState", () => {
  it("restores text-only drafts and does not persist attachments", () => {
    sessionStorage.setItem("chatnet:drafts:v1:21", JSON.stringify({ 8: { text: "saved" } }));
    const state = mountDrafts().render(8);
    expect(state.messageText).toBe("saved");
    expect(state.messageAttachments).toEqual([]);
    act(() => state.setMessageDrafts({ 8: { text: "updated", attachments: [{ id: "unused" }] as never } }));
    expect(JSON.parse(sessionStorage.getItem("chatnet:drafts:v1:21") || "{}")).toEqual({ 8: { text: "updated" } });
  });

  it("keeps drafts isolated per conversation and channel", () => {
    const app = mountDrafts();
    let state = app.render(8);
    act(() => state.setMessageDrafts({ 8: { text: "conversation", attachments: [] } }));
    state = app.render(8, 12);
    expect(state.messageText).toBe("");
    act(() => state.setChannelDrafts({ "8:12": { text: "channel", attachments: [] } }));
    expect(app.render(8, 12).messageText).toBe("channel");
    expect(app.render(8, 13).messageText).toBe("");
    expect(app.render(9).messageText).toBe("");
    expect(app.render(8).messageText).toBe("conversation");
  });

  it("does not write drafts for an invalid user", () => {
    const app = mountDrafts(0);
    const state = app.render(5);
    act(() => state.setMessageDrafts({ 5: { text: "unsaved", attachments: [] } }));
    expect(sessionStorage.length).toBe(0);
  });
});
