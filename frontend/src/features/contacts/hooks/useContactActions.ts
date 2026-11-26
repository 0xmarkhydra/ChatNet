import { useFriendActions } from "./useFriendActions";
import { createBlockedConversationActions } from "./blockedConversationActions";
import { useContactModeration } from "./useContactModeration";
import { createContactMetadataActions } from "./contactMetadataActions";
import type { UseContactActionsDeps } from "./contactActionTypes";



export function useContactActions({
  apiFetch,
  blockedBusy,
  contactMetadata,
  conversations,
  friendActionRef,
  friendBusyIds,
  friendRelationship,
  friends,
  friendSyncRequest,
  openDirectByUsername,
  refreshConversations,
  refreshFriendConnections,
  session,
  sessionRef,
  setActiveConversationId,
  setBlockedBusy,
  setBlockedError,
  setBlockedOpen,
  setBlockedUsers,
  setContactMetadata,
  setConversations,
  setDesktopSection,
  setFriendActionBusy,
  setFriendBusyIds,
  setFriendMenuId,
  setFriendPreview,
  setFriendRequests,
  setFriendResults,
  setFriends,
  setNotice,
  setTab,
}: UseContactActionsDeps) {
  const moderationActions = useContactModeration({
    apiFetch,
    blockedBusy,
    friendBusyIds,
    refreshConversations,
    refreshFriendConnections,
    session,
    sessionRef,
    setBlockedBusy,
    setBlockedError,
    setBlockedOpen,
    setBlockedUsers,
    setConversations,
    setFriendBusyIds,
    setFriendMenuId,
    setFriendPreview,
    setFriendRequests,
    setFriendResults,
    setFriends,
    setNotice,
  });
  const { openBlockedFriendConversation } = createBlockedConversationActions({
    apiFetch, conversations, friends, session, sessionRef,
    setConversations, setDesktopSection, setTab, setActiveConversationId, setNotice,
  });

  const friendActions = useFriendActions({
    apiFetch,
    friendActionRef,
    friendRelationship,
    friends,
    friendSyncRequest,
    openDirectByUsername,
    refreshFriendConnections,
    session,
    sessionRef,
    setFriendActionBusy,
    setFriendBusyIds,
    setFriendMenuId,
    setFriendPreview,
    setFriendRequests,
    setFriends,
    setNotice,
    openBlockedFriendConversation,
  });

  const { changePersonalContact } = createContactMetadataActions({
    apiFetch, contactMetadata, friendBusyIds, session, sessionRef,
    setContactMetadata, setFriendBusyIds, setFriendMenuId, setNotice,
  });

  return {
    ...moderationActions,
    ...friendActions,
    changePersonalContact,
    openBlockedFriendConversation,
  };
}