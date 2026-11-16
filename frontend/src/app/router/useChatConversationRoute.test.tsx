// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { useChatConversationRoute } from "./useChatConversationRoute";
import { chatConversationIdFromPath, chatConversationPath } from "./routes";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const dispose: Array<() => void> = [];
afterEach(() => { while (dispose.length) dispose.pop()!(); });

function mountAt(path: string, initialId: number | null = null) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Probe() {
    const [activeId, setActiveId] = useState<number | null>(initialId);
    const select = useChatConversationRoute(activeId, setActiveId);
    const navigate = useNavigate();
    const location = useLocation();
    return (
      <>
        <output data-testid="route">{location.pathname}</output>
        <output data-testid="active">{activeId === null ? "none" : String(activeId)}</output>
        <button onClick={() => navigate("/feed")}>Feed</button>
        <button onClick={() => navigate("/chat")}>Chat index</button>
        <button onClick={() => navigate("/chat/42")}>Chat 42</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate(1)}>Forward</button>
        <button onClick={() => select(99)}>Select 99</button>
        <button onClick={() => select(null)}>Clear selection</button>
      </>
    );
  }
  act(() => root.render(<MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>));
  dispose.push(() => { act(() => root.unmount()); host.remove(); });
  const read = (key: string) => host.querySelector(`[data-testid="${key}"]`)?.textContent;
  const click = (label: string) => {
    const button = Array.from(host.querySelectorAll("button")).find(item => item.textContent === label);
    if (!button) throw new Error(`Missing button ${label}`);
    act(() => button.click());
  };
  return { read, click };
}

describe("chat selection and route synchronization", () => {
  it("uses the direct conversation URL as the selected conversation", () => {
    const app = mountAt("/chat/42");
    expect(app.read("active")).toBe("42");
    app.click("Select 99");
    expect(app.read("route")).toBe("/chat/99");
    expect(app.read("active")).toBe("99");
  });

  it("clears the selected conversation on the chat index", () => {
    const app = mountAt("/chat", 42);
    expect(app.read("active")).toBe("none");
    expect(app.read("route")).toBe("/chat");
  });

  it("does not retain stale selection after visiting another tab", () => {
    const app = mountAt("/chat/42");
    app.click("Feed");
    expect(app.read("active")).toBe("42");
    app.click("Chat index");
    expect(app.read("route")).toBe("/chat");
    expect(app.read("active")).toBe("none");
    app.click("Back");
    expect(app.read("route")).toBe("/feed");
    app.click("Back");
    expect(app.read("route")).toBe("/chat/42");
    expect(app.read("active")).toBe("42");
    app.click("Forward");
    expect(app.read("route")).toBe("/feed");
  });

  it("clears selection when navigating directly from detail to list", () => {
    const app = mountAt("/chat/42");
    app.click("Chat index");
    expect(app.read("active")).toBe("none");
    app.click("Chat 42");
    expect(app.read("active")).toBe("42");
    app.click("Clear selection");
    expect(app.read("route")).toBe("/chat");
    expect(app.read("active")).toBe("none");
  });

  it("parses only positive safe integer conversation IDs", () => {
    expect(chatConversationPath(42)).toBe("/chat/42");
    expect(chatConversationIdFromPath("/chat/42")).toBe(42);
    expect(chatConversationIdFromPath("/chat/42/")).toBe(42);
    for (const path of ["/chat", "/chat/0", "/chat/-1", "/chat/abc", "/chat/01", "/chat/42/more", "/feed/42", "/chat/9007199254740992"]) {
      expect(chatConversationIdFromPath(path)).toBeNull();
    }
  });

  it("hydrates selected conversation on history Back", () => {
    const app = mountAt("/chat/42");
    app.click("Select 99");
    expect(app.read("route")).toBe("/chat/99");
    app.click("Back");
    expect(app.read("route")).toBe("/chat/42");
    expect(app.read("active")).toBe("42");
  });

  it("returns to an unselected chat list on Back", () => {
    const app = mountAt("/chat");
    app.click("Select 99");
    expect(app.read("route")).toBe("/chat/99");
    app.click("Back");
    expect(app.read("route")).toBe("/chat");
    expect(app.read("active")).toBe("none");
  });

  it("opens a shareable chat route from a call workspace", () => {
    const app = mountAt("/calls");
    app.click("Select 99");
    expect(app.read("route")).toBe("/chat/99");
    expect(app.read("active")).toBe("99");
    app.click("Clear selection");
    expect(app.read("route")).toBe("/chat");
    expect(app.read("active")).toBe("none");
  });

  it("preserves history when opening a conversation from another tab", () => {
    const app = mountAt("/feed");
    app.click("Select 99");
    expect(app.read("route")).toBe("/chat/99");
    app.click("Back");
    expect(app.read("route")).toBe("/feed");
  });

  it("does not clear chat selection just because Feed is visited", () => {
    const app = mountAt("/chat/42");
    app.click("Feed");
    expect(app.read("route")).toBe("/feed");
    expect(app.read("active")).toBe("42");
  });
});
