import type { RefObject } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { Session } from '../../shared/types/session'
import type { Notice } from '../../shared/types/api'
import { API } from '../../shared/lib/config'
import { TAB_PATH } from '../router/routes'
import { getOneSignalPushState } from '../../features/notifications/lib/onesignal'
import { resetConversationMembershipOnLogout } from '../../features/chat/lib/conversationMembershipLifecycle'

type MembershipReset = Parameters<typeof resetConversationMembershipOnLogout>[0]

export type AppLogoutDependencies = {
  setNearbyUsers: (value: never[]) => void
  setNearbyUntil: (value: number) => void
  setNearbyBusy: (value: boolean) => void
  setNearbyScanning: (value: boolean) => void
  setChatOutbox: (value: never[]) => void
  setConversations: (value: never[]) => void
  setHasMoreConversations: (value: boolean) => void
  setConversationLoadingMore: (value: boolean) => void
  setActiveConversationId: (value: null) => void
  setMessages: (value: never[]) => void
  setHasMoreMessages: (value: boolean) => void
  setMessagesLoadingMore: (value: boolean) => void
  setOutgoingMessage: (value: null) => void
  setPendingPost: (value: null) => void
  setPendingComments: (value: Record<string, never>) => void
  setLikePreviews: (value: Record<string, never>) => void
  setReactionPreviews: (value: Record<string, never>) => void
  setMessageSending: (value: boolean) => void
  setGroupBusy: (value: boolean) => void
  setProfileBusy: (value: null) => void
  setProfileSaving: (value: boolean) => void
  setStoryBusy: (value: boolean) => void
  setMediaUploading: (value: null) => void
  setMediaUploadProgress: (value: null) => void
  setFriendBusyIds: (value: Set<number>) => void
  setFriendActionBusy: (value: null) => void
  setMessageDrafts: (value: Record<string, never>) => void
  setFriends: (value: never[]) => void
  setFriendRequests: (value: never[]) => void
  setFriendMenuId: (value: null) => void
  setFriendPreview: (value: null) => void
  setPostText: (value: string) => void
  setPostTaggedFriends: (value: never[]) => void
  setPostFeelingId: (value: string) => void
  setEditingPost: (value: null) => void
  setPostEditBusy: (value: boolean) => void
  setPosts: (value: never[]) => void
  setProfileTimelineOpen: (value: boolean) => void
  setProfileComposerOpen: (value: boolean) => void
  setFeedComposerOpen: (value: boolean) => void
  setProfileEditorOpen: (value: boolean) => void
  setPostSubmitError: (value: string) => void
  setProfilePosts: (value: never[]) => void
  setProfileHasMore: (value: boolean) => void
  setProfilePostsBusy: (value: boolean) => void
  setProfilePostsError: (value: string) => void
  setHasMorePosts: (value: boolean) => void
  setPostsLoadingMore: (value: boolean) => void
  setStories: (value: never[]) => void
  setActiveStoryId: (value: null) => void
  setCommentEditors: (value: Record<string, never>) => void
  setPostAttachments: (value: never[]) => void
  setTranslations: (value: Record<string, never>) => void
  nearbyRequest: { current: number }
  chatOutboxRef: { current: unknown }
  chatOutboxSession: { current: string }
  sendingClientIDs: { current: Set<string> }
  pendingSend: { current: unknown }
  conversationOffset: { current: number }
  conversationPagingBusy: { current: boolean }
  messagesPagingBusy: { current: boolean }
  actionLocks: { current: Set<string> }
  pendingRequests: { current: { clear(): void } }
  mutationRequests: { current: { clear(): void } }
  messageReceipts: { current: { clear(): void } }
  messageSound: { current: { clearSeen(): void } | null }
  preferenceRevision: { current: number }
  sendingRef: { current: boolean }
  mediaUploadAbort: { current: { abort(): void } | null }
  friendActionRef: { current: { clear(): void } }
  feedRevision: { current: number }
  draftBeforeEdit: { current: unknown }
  profileLoadSequence: { current: number }
  profilePagingBusy: { current: boolean }
  postsPagingBusy: { current: boolean }
  visitorUsername: string | null
  navigate: NavigateFunction
  sessionRef: RefObject<Session | null>
  endSession: (revoke?: boolean, clearStorage?: boolean, notify?: Notice) => void
  setNotice: Notice
  resetSavedPosts: () => void
  revokedConversationIds: MembershipReset['revokedConversationIds']
  membershipSnapshot: MembershipReset['membershipSnapshot']
  membershipSyncSequence: MembershipReset['membershipSyncSequence']
  membershipEventSequence: MembershipReset['membershipEventSequence']
}

/**
 * Performs the original ordered logout teardown. Clearing chat outbox state
 * before ending the session is intentional: do not allow late retries to leak
 * across identities. The remaining feature resets run in their original order.
 */
export function createAppLogout(deps: AppLogoutDependencies) {
  const { setNearbyUsers, setNearbyUntil, setNearbyBusy, setNearbyScanning, setChatOutbox, setConversations, setHasMoreConversations, setConversationLoadingMore, setActiveConversationId, setMessages, setHasMoreMessages, setMessagesLoadingMore, setOutgoingMessage, setPendingPost, setPendingComments, setLikePreviews, setReactionPreviews, setMessageSending, setGroupBusy, setProfileBusy, setProfileSaving, setStoryBusy, setMediaUploading, setMediaUploadProgress, setFriendBusyIds, setFriendActionBusy, setMessageDrafts, setFriends, setFriendRequests, setFriendMenuId, setFriendPreview, setPostText, setPostTaggedFriends, setPostFeelingId, setEditingPost, setPostEditBusy, setPosts, setProfileTimelineOpen, setProfileComposerOpen, setFeedComposerOpen, setProfileEditorOpen, setPostSubmitError, setProfilePosts, setProfileHasMore, setProfilePostsBusy, setProfilePostsError, setHasMorePosts, setPostsLoadingMore, setStories, setActiveStoryId, setCommentEditors, setPostAttachments, setTranslations, nearbyRequest, chatOutboxRef, chatOutboxSession, sendingClientIDs, pendingSend, conversationOffset, conversationPagingBusy, messagesPagingBusy, actionLocks, pendingRequests, mutationRequests, messageReceipts, messageSound, preferenceRevision, sendingRef, mediaUploadAbort, friendActionRef, feedRevision, draftBeforeEdit, profileLoadSequence, profilePagingBusy, postsPagingBusy, visitorUsername, navigate, sessionRef, endSession, setNotice, resetSavedPosts, revokedConversationIds, membershipSnapshot, membershipSyncSequence, membershipEventSequence } = deps

  // Best-effort remote unsubscription must never block local logout.
  function unsubscribeRemotePresence(currentToken?: string) {
    if (currentToken) {
      void fetch(`${API}/api/users/nearby`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` },
        keepalive: true,
      }).catch(() => undefined)
    }
    void getOneSignalPushState()
      .then(async state => {
        if (!currentToken || !state.subscriptionId) return
        await fetch(`${API}/api/push/subscription`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscriptionId: state.subscriptionId }),
        })
      })
      .catch(() => undefined)
  }

  // Never end a session while its optimistic outbox still appears sendable.
  function clearOutgoingBeforeSessionEnd() {
    chatOutboxRef.current = []
    setChatOutbox([])
    chatOutboxSession.current = ''
    sendingClientIDs.current = new Set<string>()
    pendingSend.current = null
  }

  function resetFeatureStateAfterSessionEnd() {
    setConversations([])
    resetConversationMembershipOnLogout({
      revokedConversationIds, membershipSnapshot,
      membershipSyncSequence, membershipEventSequence,
    })
    setHasMoreConversations(false)
    setConversationLoadingMore(false)
    conversationOffset.current = 0
    conversationPagingBusy.current = false
    setActiveConversationId(null)
    setMessages([])
    setHasMoreMessages(false)
    setMessagesLoadingMore(false)
    messagesPagingBusy.current = false
    setOutgoingMessage(null)
    setPendingPost(null)
    setPendingComments({})
    setLikePreviews({})
    setReactionPreviews({})
    actionLocks.current = new Set<string>()
    pendingRequests.current.clear()
    mutationRequests.current.clear()
    messageReceipts.current.clear()
    messageSound.current?.clearSeen()
    ++preferenceRevision.current
    sendingRef.current = false
    setMessageSending(false)
    setGroupBusy(false)
    setProfileBusy(null)
    setProfileSaving(false)
    setStoryBusy(false)
    mediaUploadAbort.current?.abort()
    mediaUploadAbort.current = null
    setMediaUploading(null)
    setMediaUploadProgress(null)
    friendActionRef.current.clear()
    setFriendBusyIds(new Set())
    setFriendActionBusy(null)
    ++feedRevision.current
    setMessageDrafts({})
    setFriends([])
    setFriendRequests([])
    setFriendMenuId(null)
    setFriendPreview(null)
    setPostText('')
    setPostTaggedFriends([])
    setPostFeelingId('')
    setEditingPost(null)
    setPostEditBusy(false)
    draftBeforeEdit.current = null
    setPosts([])
    resetSavedPosts()
    ++profileLoadSequence.current
    profilePagingBusy.current = false
    setProfileTimelineOpen(false)
    setProfileComposerOpen(false)
    setFeedComposerOpen(false)
    setProfileEditorOpen(false)
    setPostSubmitError('')
    setProfilePosts([])
    setProfileHasMore(false)
    setProfilePostsBusy(false)
    setProfilePostsError('')
    setHasMorePosts(false)
    setPostsLoadingMore(false)
    postsPagingBusy.current = false
    setStories([])
    setActiveStoryId(null)
    setCommentEditors({})
    setPostAttachments([])
    setTranslations({})
  }

  function logout(revoke = true, clearStorage = true) {
    if (visitorUsername) navigate(TAB_PATH.chat, { replace: true })
    const currentToken = sessionRef.current?.token
    ++nearbyRequest.current
    setNearbyUsers([])
    setNearbyUntil(0)
    setNearbyBusy(false)
    setNearbyScanning(false)
    unsubscribeRemotePresence(currentToken)
    clearOutgoingBeforeSessionEnd()
    endSession(revoke, clearStorage, setNotice)
    resetFeatureStateAfterSessionEnd()
  }
  return logout
}