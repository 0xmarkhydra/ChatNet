import { useUiTranslation } from '@/shared/i18n/locale'
import type { Tab } from "../../shared/types/navigation";
import type { GroupWorkspaceMode } from "../../features/chat/components/CommunityGroupsPage";
import type { DesktopSection } from "./headerContext";

export type HeaderTitleProps = {
  tab: Tab;
  searchResults?: boolean;
  desktopSection: DesktopSection;
  translationSettingsOpen: boolean;
  groupWorkspaceMode: GroupWorkspaceMode;
  groupCreateStep: number;
  activeConversationName?: string;
  contactsDirectory: boolean;
  contactsOverview?: boolean;
  profileSettings: boolean;
  profileDesktop: boolean;
  profileEditing: boolean;
};

function groupTitle(p: HeaderTitleProps, trUi: ReturnType<typeof useUiTranslation>) {
  if (p.groupWorkspaceMode === "create") return p.groupCreateStep === 1 ? trUi('chat.communityCreate') : trUi('app.newGroup');
  if (p.groupWorkspaceMode === "manage") return trUi('app.groupAdmin');
  if (p.groupWorkspaceMode === "channel") return p.activeConversationName || trUi('common.ui.groupChannels');
  return trUi('app.groupsCommunities');
}

function groupSubtitle(p: HeaderTitleProps, trUi: ReturnType<typeof useUiTranslation>) {
  if (p.groupWorkspaceMode === "create") {
    return p.groupCreateStep === 1 ? trUi('app.groupSetup') : trUi('app.groupStep', { step: p.groupCreateStep });
  }
  if (p.groupWorkspaceMode === "manage") return trUi('app.groupAdminSubtitle');
  if (p.groupWorkspaceMode === "channel") return trUi('app.channelSubtitle');
  return trUi('app.groupsSubtitle');
}

export default function HeaderTitle(p: HeaderTitleProps) {
  const trUi = useUiTranslation()
  const title: Record<Tab, string> = {
    chat: trUi('chat.messages'),
    contacts: trUi('contacts.directory'),
    notifications: trUi('common.notifications'),
    discover: trUi('discover.discover'),
    market: trUi('discover.market'),
    feed: trUi('feed.feed'),
    profile: p.profileSettings && p.profileDesktop ? trUi('common.settings') : p.profileEditing ? trUi('profile.editProfile') : trUi('app.personalProfile'),
  };
  const subtitle: Record<Tab, string> = {
    chat: p.translationSettingsOpen
      ? trUi('app.translationSubtitle')
      : p.desktopSection === "groups" ? groupSubtitle(p, trUi) : trUi('app.chatSubtitle'),
    contacts: trUi('app.contactsSubtitle'),
    notifications: trUi('app.notificationsSubtitle'),
    discover: trUi('app.discoverSubtitle'),
    market: trUi('app.marketSubtitle'),
    feed: trUi('app.feedSubtitle'),
    profile: p.profileSettings
      ? trUi('app.settingsSubtitle')
      : p.profileEditing ? trUi('app.profileEditSubtitle') : trUi('app.profileSubtitle'),
  };
  const heading = p.searchResults ? trUi('common.searchResults') : p.tab === "chat" && p.translationSettingsOpen
    ? trUi('chat.languageAI')
    : p.tab === "chat" && p.desktopSection === "groups"
      ? groupTitle(p, trUi)
      : p.tab === "chat" && p.desktopSection === "calls"
        ? trUi('common.ui.call')
        : title[p.tab];
  const showSubtitle = p.searchResults || p.translationSettingsOpen ||
    (p.tab === "chat" && p.desktopSection === "groups" && p.groupWorkspaceMode !== "list") ||
    (p.tab === "profile" && (p.profileEditing || p.profileSettings));
  return (
    <div className="app-page-heading">
      <strong>{heading}</strong>
      {showSubtitle && <small>{p.searchResults ? trUi('app.searchSubtitle') : subtitle[p.tab]}</small>}
    </div>
  );
}