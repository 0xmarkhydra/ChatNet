import { ROUTE } from "../../../app/routes";
import NotificationsPage from "./NotificationsPage";
import type { FriendSearchResult, FriendConnection } from "../../contacts/types";
import { type Conversation } from "../../chat/types";
import { type SetStateAction } from "react";
import { type FriendsScreen } from "../../contacts/components/ContactsView";
import type { Tab } from "../../../app/types";
import type { Dispatch } from "react";

export type NotificationsSectionProps = {
  actOnFriend: (friend: FriendSearchResult | FriendConnection, decline?: boolean) => Promise<void>;
  conversations: Conversation[];
  declineFriendRequest: (friend: FriendConnection) => Promise<void>;
  friendBusyIds: Set<number>;
  friendRequests: FriendConnection[];
  globalSearch: string;
  openVisitor: (username: string) => void;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setProfileTimelineOpen: Dispatch<SetStateAction<boolean>>;
  switchTab: (nextTab: Tab, path?: string) => void;
};

export default function NotificationsSection({
  actOnFriend,
  conversations,
  declineFriendRequest,
  friendBusyIds,
  friendRequests,
  globalSearch,
  openVisitor,
  setActiveConversationId,
  setProfileTimelineOpen,
  switchTab,
}: NotificationsSectionProps) {
  return (
      <NotificationsPage
            requests={friendRequests}
            conversations={conversations}
            search={globalSearch}
            busyFriendIds={friendBusyIds}
            onAccept={(friend) => void actOnFriend(friend)}
            onDecline={(friend) => void declineFriendRequest(friend)}
            onOpenConversation={(id) => {
              switchTab("chat");
              setActiveConversationId(id);
            }}
            onOpenInvitations={() => {
              switchTab("contacts", ROUTE.invitations);
            }}
            onOpenFriend={openVisitor}
            onSettings={() => {
              switchTab("profile", ROUTE.settings);
              setProfileTimelineOpen(false);
            }}
          />
  );
}
