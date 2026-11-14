import { Bell, MessageCircle, PencilLine, Search, Users } from "lucide-react";
import type { ReactNode } from "react";
import UiIcon from "../../shared/ui/UiIcon";
import { Button } from "../../shared/ui/button";
import { cn } from "../../shared/lib/utils";
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

/** All toolbar icon controls share one accessible button primitive. */
function HeaderIconButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button variant="ghost" size="icon" className={cn("appbar-icon-button", className)} {...props} />;
}

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
      {!groups && (
        <HeaderIconButton aria-label="Quét QR" onClick={chat.onScanQr}>
          <UiIcon name="qr" size={28} />
        </HeaderIconButton>
      )}
      <div className="appbar-create-anchor">
        <HeaderIconButton
          className={cn("appbar-create-trigger", chat.quickCreateOpen && "active")}
          type="button"
          aria-label={groups ? "Tạo cộng đồng mới" : "Tạo mới"}
          aria-expanded={groups ? false : chat.quickCreateOpen}
          aria-haspopup={groups ? undefined : "menu"}
          onClick={groups ? chat.onCreateCommunity : chat.onToggleQuickCreate}
        >
          <UiIcon name="plus" size={29} />
        </HeaderIconButton>
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

/** Route actions remain feature-specific; notification access stays consistent on every page. */
export default function HeaderActions(p: HeaderActionsProps) {
  const notification = (
    <HeaderIconButton
      className="notification-appbar"
      aria-label={p.tab === "notifications" ? "Trang Thông báo" : "Mở thông báo"}
      aria-current={p.tab === "notifications" ? "page" : undefined}
      onClick={p.tab === "notifications" ? undefined : p.onOpenNotifications}
    >
      <Bell size={21} aria-hidden="true" />
      <NotificationBadge count={p.notificationCount} text={p.notificationBadgeText} />
    </HeaderIconButton>
  );

  let pageActions: ReactNode = null;
  switch (p.tab) {
    case "chat":
      pageActions = <ChatActions {...p} />;
      break;
    case "feed":
      pageActions = (
        <HeaderIconButton
          className="social-feed-header-community"
          type="button"
          aria-label="Cộng đồng"
          title="Cộng đồng"
          aria-pressed={p.feed.communitiesOpen}
          onClick={p.feed.onToggleCommunities}
        >
          <Users size={21} aria-hidden="true" />
        </HeaderIconButton>
      );
      break;
    case "profile":
      pageActions = (
        <HeaderIconButton className="profile-page-header-new" type="button" aria-label="Tạo bài viết" onClick={p.profile.onNewPost}>
          <PencilLine size={21} aria-hidden="true" />
        </HeaderIconButton>
      );
      break;
    case "notifications":
      pageActions = (
        <HeaderIconButton aria-label="Tạo bài viết mới" onClick={p.notifications.onNewPost}>
          <UiIcon name="plus" size={27} />
        </HeaderIconButton>
      );
      break;
    case "contacts":
      pageActions = (
        <HeaderIconButton aria-label="Thêm bạn" onClick={p.contacts.onAddFriend}>
          <UiIcon name="plus" size={27} />
        </HeaderIconButton>
      );
      break;
  }

  return <>{pageActions}{notification}</>;
}