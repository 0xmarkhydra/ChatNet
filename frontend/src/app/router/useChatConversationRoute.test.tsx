// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { useChatConversationRoute } from "./useChatConversationRoute";
import { chatConversationIdFromPath, chatConversationPath } from "./routes";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];

function mountAt(path: string) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  function Probe() {
    const location = useLocation();
    const navigate = useNavigate();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selectConversation = useChatConversationRoute(selectedId, setSelectedId);
    return (
      <div>
        <output data-testid="path">{location.pathname}</output>
        <output data-testid="selected">{selectedId ?? "none"}</output>
        <button onClick={() => selectConversation(42)}>Open 42</button>
        <button onClick={() => selectConversation(43)}>Open 43</button>
        <button onClick={() => selectConversation(null)}>Close</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate("/feed")}>Feed</button>
      </div>
    );
  }
  act(() => root.render(<MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>));
  cleanup.push(() => { act(() => root.unmount()); container.remove(); });

  const text = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent;
  const click = (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label);
    if (!button) throw new Error(`Missing button ${label}`);
    act(() => button.click());
  };
  return { text, click };
}

afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});

describe("chat conversation routes", () => {
  it("parses only valid positive safe integer conversation IDs", () => {
    expect(chatConversationPath(42)).toBe("/chat/42");
    expect(chatConversationIdFromPath("/chat/42")).toBe(42);
    expect(chatConversationIdFromPath("/chat/42/")).toBe(42);
    for (const path of ["/chat", "/chat/0", "/chat/-1", "/chat/abc", "/chat/01", "/chat/42/more", "/feed/42", "/chat/9007199254740992"]) {
      expect(chatConversationIdFromPath(path)).toBeNull();
    }
  });

  it("hydrates a directly opened URL and updates selection on Back/Forward navigation", () => {
    const app = mountAt("/chat/42");
    expect(app.text("selected")).toBe("42");
    app.click("Open 43");
    expect(app.text("path")).toBe("/chat/43");
    expect(app.text("selected")).toBe("43");
    app.click("Back");
    expect(app.text("path")).toBe("/chat/42");
    expect(app.text("selected")).toBe("42");
  });

  it("keeps chat list navigation and closes the conversation on Back", () => {
    const app = mountAt("/chat");
    app.click("Open 42");
    expect(app.text("path")).toBe("/chat/42");
    app.click("Back");
    expect(app.text("path")).toBe("/chat");
    expect(app.text("selected")).toBe("none");
  });

  it("does not clear chat selection simply because another tab is visited", () => {
    const app = mountAt("/chat/42");
    app.click("Feed");
    expect(app.text("path")).toBe("/feed");
    expect(app.text("selected")).toBe("42");
  });
});
