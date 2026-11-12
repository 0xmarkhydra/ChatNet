import { Bell, MessageCircle, PencilLine, Search, Users } from "lucide-react";
import type { ReactNode } from "react";
import UiIcon from "../../shared/ui/UiIcon";
import type { Tab } from "../../shared/types/navigation";
import type { DesktopSection } from "./headerContext";

export type HeaderActionsProps = {
  tab: Tab;
  desktopSection: DesktopSection;
  notificationCount: number;
  notificationBadgeText: string;
  onOpenNotifications: () => void;
  chat: {
    quickCreateOpen: boolean;
    onScanQr: () => void;
    onCreateCommunity: () => void;
    onToggleQuickCreate: () => void;
    onCloseQuickCreate: () => void;
    onConnect: () => void;
    onNewDirect: () => void;
    onNewGroup: () => void;
  };
  feed: { communitiesOpen: boolean; onToggleCommunities: () => void };
  profile: { onNewPost: () => void };
  notifications: { onNewPost: () => void };
  contacts: { onAddFriend: () => void };
};

function NotificationBadge({ count, text }: { count: number; text: string }) {
  return count > 0 ? <span className="appbar-badge appbar-badge-count" aria-hidden="true">{text}</span> : null;
}

function QuickCreateItem({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}>
      <span className="quick-create-symbol">{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{hint}</small>
      </div>
    </button>
  );
}

function ChatActions(p: HeaderActionsProps) {
  const { chat, desktopSection } = p;
  const groups = desktopSection === "groups";
  return (
    <>
      {groups && (
        <button type="button" className="appbar-icon-button notification-appbar" aria-label="Mở thông báo" onClick={p.onOpenNotifications}>
          <Bell size={22} aria-hidden="true" />
          <NotificationBadge count={p.notificationCount} text={p.notificationBadgeText} />
        </button>
      )}
      {!groups && (
        <button className="appbar-icon-button" type="button" aria-label="Quét QR" onClick={chat.onScanQr}>
          <UiIcon name="qr" size={28} />
        </button>
      )}
      <div className="appbar-create-anchor">
        <button
          className={chat.quickCreateOpen ? "appbar-icon-button appbar-create-trigger active" : "appbar-icon-button appbar-create-trigger"}
          type="button"
          aria-label={groups ? "Tạo cộng đồng mới" : "Tạo mới"}
          aria-expanded={groups ? false : chat.quickCreateOpen}
          aria-haspopup={groups ? undefined : "menu"}
          onClick={groups ? chat.onCreateCommunity : chat.onToggleQuickCreate}
        >
          <UiIcon name="plus" size={29} />
        </button>
        {chat.quickCreateOpen && !groups && (
          <>
            <button type="button" className="quick-create-dismiss" aria-label="Đóng menu tạo mới" onClick={chat.onCloseQuickCreate} />
            <div className="quick-create-menu" role="menu" aria-label="Tạo cuộc trò chuyện mới">
              <div className="quick-create-caption">TẠO MỚI</div>
              <QuickCreateItem icon={<Search size={19} aria-hidden="true" />} title="Tìm & kết nối" hint="Tìm bạn bè bằng tên hoặc @username" onClick={chat.onConnect} />
              <QuickCreateItem icon={<MessageCircle size={19} aria-hidden="true" />} title="Chat riêng" hint="Bắt đầu cuộc trò chuyện 1-1" onClick={chat.onNewDirect} />
              <QuickCreateItem icon={<Users size={19} aria-hidden="true" />} title="Tạo nhóm" hint="Trò chuyện cùng nhiều người" onClick={chat.onNewGroup} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Page-specific header actions; the account control is rendered separately by HeaderAccount. */
export default function HeaderActions(p: HeaderActionsProps) {
  const badge = <NotificationBadge count={p.notificationCount} text={p.notificationBadgeText} />;
  switch (p.tab) {
    case "chat":
      return <ChatActions {...p} />;
    case "feed":
      return (
        <>
          <button
            className="appbar-icon-button social-feed-header-community"
            type="button"
            aria-label="Cộng đồng"
            title="Cộng đồng"
            aria-pressed={p.feed.communitiesOpen}
            onClick={p.feed.onToggleCommunities}
          >
            <Users size={23} aria-hidden="true" />
          </button>
          <button className="appbar-icon-button notification-appbar" type="button" aria-label="Mở thông báo" onClick={p.onOpenNotifications}>
            <UiIcon name="bell" size={27} />
            {badge}
          </button>
        </>
      );
    case "profile":
      return (
        <>
          <button className="appbar-icon-button notification-appbar" type="button" aria-label="Mở thông báo" onClick={p.onOpenNotifications}>
            <Bell size={21} aria-hidden="true" />
            {badge}
          </button>
          <button className="appbar-icon-button profile-page-header-new" type="button" aria-label="Tạo bài viết" onClick={p.profile.onNewPost}>
            <PencilLine size={21} aria-hidden="true" />
          </button>
        </>
      );
    case "notifications":
      return (
        <>
          <button className="appbar-icon-button notification-appbar" type="button" aria-label="Trang Thông báo" aria-current="page">
            <Bell size={22} aria-hidden="true" />
            {badge}
          </button>
          <button className="appbar-icon-button" type="button" aria-label="Tạo bài viết mới" onClick={p.notifications.onNewPost}>
            <UiIcon name="plus" size={31} />
          </button>
        </>
      );
    case "contacts":
      return (
        <>
          <button className="appbar-icon-button notification-appbar" type="button" aria-label="Mở trang Thông báo" title="Thông báo" onClick={p.onOpenNotifications}>
            <Bell size={22} aria-hidden="true" />
            {badge}
          </button>
          <button className="appbar-icon-button" type="button" aria-label="Thêm bạn" onClick={p.contacts.onAddFriend}>
            <UiIcon name="plus" size={31} />
          </button>
        </>
      );
    default:
      return null;
  }
}
