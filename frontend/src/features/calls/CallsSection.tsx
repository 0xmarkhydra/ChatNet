import type { ReactNode } from "react";
import CallCenter from "./CallCenter";
import { type Session } from "../auth/session";
import { type SetStateAction } from "react";
import { type FriendsScreen } from "../contacts/ContactsView";
import type { Tab } from "../../app/types";
import type { Dispatch } from "react";

export type CallsSectionProps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  contactsContent: ReactNode;
  displayConversations: { name: string; categoryId?: number; pinnedAt?: string; id: number; type: "direct" | "group"; blockedByMe?: boolean; blockedByOther?: boolean; otherUserId?: number; otherUsername?: string; memberCount: number; unreadCount: number; lastMessage: string; lastMessageAt?: string; online: boolean; createdAt: string; }[];
  friendQuery: string;
  session: Session;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setContactsScreen: (next: FriendsScreen) => void;
  setDesktopSection: (next: "groups" | "calls" | null) => void;
  setFriendQuery: Dispatch<SetStateAction<string>>;
  switchTab: (nextTab: Tab) => void;
  targetLanguage: string;
};

export default function CallsSection({
  apiFetch,
  contactsContent,
  displayConversations,
  friendQuery,
  session,
  setActiveConversationId,
  setContactsScreen,
  setDesktopSection,
  setFriendQuery,
  switchTab,
  targetLanguage,
}: CallsSectionProps) {
  return (
      <CallCenter
            embedded
            request={apiFetch}
            userId={session.user.id}
            token={session.token}
            conversations={displayConversations}
            targetLanguage={targetLanguage}
            directoryContent={contactsContent}
            directoryQuery={friendQuery}
            onDirectoryQueryChange={setFriendQuery}
            onDirectoryOpen={() => setContactsScreen("directory")}
            onNavigate={(destination) => switchTab(destination)}
            onOpenChat={(id) => { setDesktopSection(null); setActiveConversationId(id); }}

          />
  );
}
