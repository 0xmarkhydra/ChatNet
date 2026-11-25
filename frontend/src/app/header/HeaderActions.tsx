import { Bell, MessageCircle, PencilLine, Search, UserRoundPlus, Users } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (chat.quickCreateOpen) {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    } else if (wasOpenRef.current) {
      anchorRef.current?.querySelector<HTMLButtonElement>('.appbar-create-trigger')?.focus({ preventScroll: true });
    }
    wasOpenRef.current = chat.quickCreateOpen;
  }, [chat.quickCreateOpen]);

  function trapMenuFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      chat.onCloseQuickCreate();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {!groups && (
        <HeaderIconButton className="appbar-qr-action" aria-label="Quét QR" onClick={chat.onScanQr}>
          <UiIcon name="qr" size={28} />
        </HeaderIconButton>
      )}
      <div className="appbar-create-anchor" ref={anchorRef}>
        <HeaderIconButton
          className={cn("appbar-create-trigger appbar-primary-action", chat.quickCreateOpen && "active")}
          type="button"
          aria-label={groups ? "Tạo cộng đồng mới" : "Tạo mới"}
          aria-expanded={groups ? false : chat.quickCreateOpen}
          aria-haspopup={groups ? undefined : "menu"}
          onClick={groups ? chat.onCreateCommunity : chat.onToggleQuickCreate}
        >
          <UiIcon name="plus" size={23} /><span className="appbar-action-label">{groups ? "Tạo cộng đồng" : "Tạo mới"}</span>
        </HeaderIconButton>
        {chat.quickCreateOpen && !groups && (
          <>
            <button type="button" className="quick-create-dismiss" aria-label="Đóng menu tạo mới" onClick={chat.onCloseQuickCreate} />
            <div ref={menuRef} className="quick-create-menu" role="menu" aria-label="Tạo cuộc trò chuyện mới" onKeyDown={trapMenuFocus}>
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

/** Page actions live at the end; the existing desktop sidebar owns notifications. */
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
          className="social-feed-header-community appbar-mobile-community"
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
        <HeaderIconButton className="profile-page-header-new appbar-primary-action" type="button" aria-label="Đăng bài" onClick={p.profile.onNewPost}>
          <PencilLine size={20} aria-hidden="true" /><span className="appbar-action-label">Đăng bài</span>
        </HeaderIconButton>
      );
      break;
    case "notifications":
      pageActions = (
        <HeaderIconButton className="appbar-primary-action" aria-label="Đăng bài" onClick={p.notifications.onNewPost}>
          <UiIcon name="plus" size={21} /><span className="appbar-action-label">Đăng bài</span>
        </HeaderIconButton>
      );
      break;
    case "contacts":
      pageActions = (
        <HeaderIconButton className="appbar-primary-action" aria-label="Thêm bạn" onClick={p.contacts.onAddFriend}>
          <UserRoundPlus size={19} aria-hidden="true" /><span className="appbar-action-label">Thêm bạn</span>
        </HeaderIconButton>
      );
      break;
  }

  return <>{pageActions}<span className="appbar-mobile-notification">{notification}</span></>;
}
