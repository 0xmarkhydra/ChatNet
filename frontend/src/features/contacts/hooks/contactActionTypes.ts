import type { FriendSearchResult, FriendConnection } from '../types'
import type { Conversation } from '../../chat/types'
import type { Session } from '../../auth/lib/session'
import type { SetStateAction, Dispatch, RefObject } from 'react'
import type { ToastKind } from '../../../shared/utils/toast'
import type { Tab } from '../../../shared/types/navigation'

export type UseContactActionsDeps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  blockedBusy: boolean;
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean; }>;
  conversations: Conversation[];
  friendActionRef: RefObject<Set<number>>;
  friendBusyIds: Set<number>;
  friendRelationship: (userId: number) => "accepted" | "incoming" | "outgoing" | "none";
  friends: FriendConnection[];
  friendSyncRequest: RefObject<number>;
  openDirectByUsername: (username: string, mediaType?: "audio" | "video", onOpened?: (conversation: Conversation) => void) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshFriendConnections: () => Promise<void>;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setBlockedBusy: Dispatch<SetStateAction<boolean>>;
  setBlockedError: Dispatch<SetStateAction<string>>;
  setBlockedOpen: Dispatch<SetStateAction<boolean>>;
  setBlockedUsers: Dispatch<SetStateAction<{ id: number; username: string; displayName: string; }[]>>;
  setContactMetadata: Dispatch<SetStateAction<Record<number, { nickname: string; note: string; favorite: boolean; }>>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setDesktopSection: Dispatch<SetStateAction<"groups" | "calls" | null>>;
  setFriendActionBusy: Dispatch<SetStateAction<number | null>>;
  setFriendBusyIds: Dispatch<SetStateAction<Set<number>>>;
  setFriendMenuId: Dispatch<SetStateAction<number | null>>;
  setFriendPreview: (friend: FriendSearchResult | null) => void;
  setFriendRequests: Dispatch<SetStateAction<FriendConnection[]>>;
  setFriendResults: Dispatch<SetStateAction<FriendSearchResult[]>>;
  setFriends: Dispatch<SetStateAction<FriendConnection[]>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setTab: Dispatch<SetStateAction<Tab>>;
};
