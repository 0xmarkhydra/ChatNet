import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HeaderActions, { type HeaderActionsProps } from "../src/app/header/HeaderActions";
import HeaderAccount from "../src/app/header/HeaderAccount";

const actions: HeaderActionsProps = {
  tab: "chat",
  desktopSection: null,
  notificationCount: 3,
  notificationBadgeText: "3",
  onOpenNotifications: () => {},
  chat: {
    quickCreateOpen: false,
    onScanQr: () => {},
    onCreateCommunity: () => {},
    onToggleQuickCreate: () => {},
    onCloseQuickCreate: () => {},
    onConnect: () => {},
    onNewDirect: () => {},
    onNewGroup: () => {},
  },
  feed: { communitiesOpen: false, onToggleCommunities: () => {} },
  profile: { onNewPost: () => {} },
  notifications: { onNewPost: () => {} },
  contacts: { onAddFriend: () => {} },
};

describe("consistent main-layout header actions", () => {
  it.each(["chat", "feed", "contacts", "notifications", "profile", "discover", "market"] as const)(
    "keeps the notification action and unread badge on %s",
    tab => {
      const html = renderToStaticMarkup(<HeaderActions {...actions} tab={tab} />);
      expect(html.match(/<button[^>]*class="[^"]*notification-appbar[^"]*"/g)).toHaveLength(1);
      expect(html).toContain('data-slot="button"');
      expect(html).toContain("appbar-badge-count");
      expect(html).toContain(tab === "notifications" ? 'aria-current="page"' : 'aria-label="Mở thông báo"');
    },
  );

  it("keeps the account accessible on desktop without adding a mobile duplicate", () => {
    const html = renderToStaticMarkup(
      <HeaderAccount variant="profile" username="tester" displayName="Tester" onClick={() => {}} desktopOnly />,
    );
    expect(html).toContain("app-header-account-desktop-only");
    expect(html).toContain('aria-label="Mở trang cá nhân"');
  });
});
