// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import AppComposerOverlays from "./AppComposerOverlays";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.mock("../../features/feed/components/FeedComposerOverlay", () => ({
  default: () => <div data-testid="feed-composer">Feed composer</div>,
}));
vi.mock("../../features/profile/components/ProfileComposerOverlay", () => ({
  default: () => <div data-testid="profile-composer">Profile composer</div>,
}));

const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});

function renderComposer({
  tab = "feed",
  feedComposerOpen = false,
  profileComposerOpen = false,
  profileTimelineOpen = false,
  desktopProfileOverview = false,
}: {
  tab?: "feed" | "profile" | "chat";
  feedComposerOpen?: boolean;
  profileComposerOpen?: boolean;
  profileTimelineOpen?: boolean;
  desktopProfileOverview?: boolean;
} = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(
    <AppComposerOverlays
      tab={tab}
      feedComposerOpen={feedComposerOpen}
      profileComposerOpen={profileComposerOpen}
      profileTimelineOpen={profileTimelineOpen}
      desktopProfileOverview={desktopProfileOverview}
      editingPost={null}
      mediaUploading={null}
      pendingPost={null}
      postComposer={<p>Draft</p>}
      postEditBusy={false}
      restoreDraftAfterEdit={vi.fn()}
      setFeedCheckInOpen={vi.fn()}
      setFeedComposerOpen={vi.fn()}
      setProfileComposerOpen={vi.fn()}
    />,
  ));
  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

it("shows the feed composer only on feed", () => {
  expect(renderComposer({ tab: "feed", feedComposerOpen: true }).querySelector('[data-testid="feed-composer"]')).not.toBeNull();
  expect(renderComposer({ tab: "chat", feedComposerOpen: true }).querySelector('[data-testid="feed-composer"]')).toBeNull();
});

it("shows the profile composer for timeline and desktop profile overview", () => {
  expect(renderComposer({ tab: "profile", profileComposerOpen: true, profileTimelineOpen: true }).querySelector('[data-testid="profile-composer"]')).not.toBeNull();
  expect(renderComposer({ tab: "profile", profileComposerOpen: true, desktopProfileOverview: true }).querySelector('[data-testid="profile-composer"]')).not.toBeNull();
});

it("does not show the profile composer outside profile surfaces", () => {
  expect(renderComposer({ tab: "profile", profileComposerOpen: true }).querySelector('[data-testid="profile-composer"]')).toBeNull();
  expect(renderComposer({ tab: "chat", profileComposerOpen: true, profileTimelineOpen: true }).querySelector('[data-testid="profile-composer"]')).toBeNull();
});

it("does not mount hidden composer overlays", () => {
  const container = renderComposer({ tab: "feed" });
  expect(container.querySelector('[data-testid="feed-composer"]')).toBeNull();
  expect(container.querySelector('[data-testid="profile-composer"]')).toBeNull();
});
