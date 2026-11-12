import NotificationsPage from "./NotificationsPage";
import type { FriendSearchResult, FriendConnection } from "../../contacts/types";
import { type Conversation } from "../../chat/types";
import type { PostMentionNotification } from "../../feed/utils/postMentionNotifications";
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
  openMentionPost: (mention: PostMentionNotification) => Promise<void>;
  openVisitor: (username: string) => void;
  postMentions: PostMentionNotification[];
  readPostMention: (id: number) => Promise<void>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setContactsScreen: Dispatch<SetStateAction<FriendsScreen>>;
  setDesktopProfileSettings: Dispatch<SetStateAction<boolean>>;
  setProfileTimelineOpen: Dispatch<SetStateAction<boolean>>;
  switchTab: (nextTab: Tab) => void;
};

export default function NotificationsSection({
  actOnFriend,
  conversations,
  declineFriendRequest,
  friendBusyIds,
  friendRequests,
  globalSearch,
  openMentionPost,
  openVisitor,
  postMentions,
  readPostMention,
  setActiveConversationId,
  setContactsScreen,
  setDesktopProfileSettings,
  setProfileTimelineOpen,
  switchTab,
}: NotificationsSectionProps) {
  return (
      <NotificationsPage
            requests={friendRequests}
            conversations={conversations}
            mentions={postMentions}
            onReadMention={(id) => void readPostMention(id)}
            onOpenMention={(mention) => void openMentionPost(mention)}
            search={globalSearch}
            busyFriendIds={friendBusyIds}
            onAccept={(friend) => void actOnFriend(friend)}
            onDecline={(friend) => void declineFriendRequest(friend)}
            onOpenConversation={(id) => {
              switchTab("chat");
              setActiveConversationId(id);
            }}
            onOpenInvitations={() => {
              switchTab("contacts");
              setContactsScreen("invitations");
            }}
            onOpenFriend={openVisitor}
            onSettings={() => {
              switchTab("profile");
              setDesktopProfileSettings(true);
              setProfileTimelineOpen(false);
            }}
          />
  );
}
