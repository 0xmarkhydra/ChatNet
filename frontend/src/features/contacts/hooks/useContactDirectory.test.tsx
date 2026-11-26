// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { FriendConnection } from "../types";
import { useContactDirectory } from "./useContactDirectory";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const friends: FriendConnection[] = [
  { id: 1, username: "an", displayName: "An", online: true, updatedAt: "", status: "accepted" },
  { id: 2, username: "binh", displayName: "Bình", online: false, updatedAt: "", status: "accepted" },
];
const metadata = { 1: { nickname: "Bạn An", note: "", favorite: true } };

it("retains the directory results when unrelated search text changes outside the calls view", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const snapshots: unknown[] = [];
  function Probe({ query, embedded }: { query: string; embedded: boolean }) {
    const directory = useContactDirectory({
      friends, contactMetadata: metadata, embeddedInCalls: embedded,
      friendQuery: query, directoryFilter: "alphabetical", callConversations: [],
    });
    snapshots.push(directory.visibleFriends);
    return <span>{directory.visibleFriends.map(item => item.username).join(",")}</span>;
  }
  try {
    act(() => root.render(<Probe query="a" embedded={false} />));
    act(() => root.render(<Probe query="different" embedded={false} />));
    expect(snapshots[1]).toBe(snapshots[0]);
    expect(host.textContent).toBe("an,binh");
    act(() => root.render(<Probe query="binh" embedded={true} />));
    expect(host.textContent).toBe("binh");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
