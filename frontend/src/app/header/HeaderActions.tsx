import { useUiTranslation } from '@/shared/i18n/locale'
import { Bell, MessageCircle, PencilLine, Search, UserRoundPlus, Users } from "lucide-react";
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
  const trUi = useUiTranslation()

  const { chat, desktopSection } = p;
  const groups = desktopSection === "groups";
  return (
    <>
      {!groups && (
        <HeaderIconButton className="appbar-qr-action" aria-label={trUi("profile.scanQr")} onClick={chat.onScanQr}>
          <UiIcon name="qr" size={28} />
        </HeaderIconButton>
      )}
      <div className="appbar-create-anchor">
        <HeaderIconButton
          className={cn("appbar-create-trigger appbar-primary-action", chat.quickCreateOpen && "active")}
          type="button"
          aria-label={groups ? trUi("chat.communityCreate") : trUi("common.new")}
          aria-expanded={groups ? false : chat.quickCreateOpen}
          aria-haspopup={groups ? undefined : "menu"}
          onClick={groups ? chat.onCreateCommunity : chat.onToggleQuickCreate}
        >
          <UiIcon name="plus" size={23} /><span className="appbar-action-label">{groups ? trUi("chat.communityCreate") : trUi("common.new")}</span>
        </HeaderIconButton>
        {chat.quickCreateOpen && !groups && (
          <>
            <button type="button" className="quick-create-dismiss" aria-label={trUi("app.closeCreate")} onClick={chat.onCloseQuickCreate} />
            <div className="quick-create-menu" role="menu" aria-label={trUi("chat.newConversationFull")}>
              <div className="quick-create-caption">{trUi("app.create")}</div>
              <QuickCreateItem icon={<Search size={19} aria-hidden="true" />} title={trUi("contacts.findConnect")} hint={trUi("contacts.friendSearch")} onClick={chat.onConnect} />
              <QuickCreateItem icon={<MessageCircle size={19} aria-hidden="true" />} title={trUi("app.privateChat")} hint={trUi("app.startChat")} onClick={chat.onNewDirect} />
              <QuickCreateItem icon={<Users size={19} aria-hidden="true" />} title={trUi("chat.groupCreate")} hint={trUi("app.groupChat")} onClick={chat.onNewGroup} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Page actions live at the end; the existing desktop sidebar owns notifications. */
export default function HeaderActions(p: HeaderActionsProps) {
  const trUi = useUiTranslation()

  const notification = (
    <HeaderIconButton
      className="notification-appbar"
      aria-label={p.tab === "notifications" ? trUi("notifications.page") : trUi("notifications.open")}
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
          aria-label={trUi("feed.community")}
          title={trUi("feed.community")}
          aria-pressed={p.feed.communitiesOpen}
          onClick={p.feed.onToggleCommunities}
        >
          <Users size={21} aria-hidden="true" />
        </HeaderIconButton>
      );
      break;
    case "profile":
      pageActions = (
        <HeaderIconButton className="profile-page-header-new appbar-primary-action" type="button" aria-label={trUi("feed.publish")} onClick={p.profile.onNewPost}>
          <PencilLine size={20} aria-hidden="true" /><span className="appbar-action-label">{trUi("feed.publish")}</span>
        </HeaderIconButton>
      );
      break;
    case "notifications":
      pageActions = (
        <HeaderIconButton className="appbar-primary-action" aria-label={trUi("feed.publish")} onClick={p.notifications.onNewPost}>
          <UiIcon name="plus" size={21} /><span className="appbar-action-label">{trUi("feed.publish")}</span>
        </HeaderIconButton>
      );
      break;
    case "contacts":
      pageActions = (
        <HeaderIconButton className="appbar-primary-action" aria-label={trUi("contacts.addFriendAlt")} onClick={p.contacts.onAddFriend}>
          <UserRoundPlus size={19} aria-hidden="true" /><span className="appbar-action-label">{trUi("contacts.addFriendAlt")}</span>
        </HeaderIconButton>
      );
      break;
  }

  return <>{pageActions}<span className="appbar-mobile-notification">{notification}</span></>;
}