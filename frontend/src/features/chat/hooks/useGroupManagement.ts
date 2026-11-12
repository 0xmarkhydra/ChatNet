import { useState, useEffect, useMemo, useRef, type RefObject } from 'react'
import type { Session } from '../../auth/lib/session'
import type { Tab } from '../../../shared/types/navigation'
import type { FriendConnection } from '../../contacts/types'
import type { Conversation, GroupMember } from '../types'
import type { ToastKind } from '../../../shared/utils/toast'
import { addGroupMembers, getGroupSettings, listGroupMembers, removeGroupMember as removeGroupMemberRequest, setGroupMemberRole } from '../api/groups'

type Options = {
  session: Session | null
  sessionRef: RefObject<Session | null>
  tab: Tab
  communityWorkspaceOpen: boolean
  activeConversationId: number | null
  activeConversationType?: Conversation['type']
  activeConversationIdRef: RefObject<number | null>
  friends: FriendConnection[]
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  refreshFriendConnections: () => Promise<void>
  refreshConversations: () => Promise<void>
  setActiveConversationId: (id: number | null) => void
  setNotice: (text: string, kind?: ToastKind) => void
  actionLocks: RefObject<Set<string>>
}

export function useGroupManagement({
  session,
  sessionRef,
  tab,
  communityWorkspaceOpen,
  activeConversationId,
  activeConversationType,
  activeConversationIdRef,
  friends,
  apiFetch,
  refreshFriendConnections,
  refreshConversations,
  setActiveConversationId,
  setNotice,
  actionLocks,
}: Options) {
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupInviteSearch, setGroupInviteSearch] = useState('')
  const [groupInviteSelection, setGroupInviteSelection] = useState<number[]>([])
  const [groupBusy, setGroupBusy] = useState(false)
  const [groupPolicy, setGroupPolicy] = useState<{ adminCanInvite: boolean; adminCanEditInfo: boolean } | null>(null)
  const groupRequestRef = useRef(apiFetch)
  groupRequestRef.current = apiFetch

  // Header permissions and avatar previews must work before the sidebar is opened.
  // Fetch only for the selected group, not for every conversation in the list.
  useEffect(() => {
    setGroupMembers([])
    setGroupPolicy(null)
    if ((tab !== 'chat' && !communityWorkspaceOpen) || activeConversationType !== 'group' || !activeConversationId || !session?.token) return

    const controller = new AbortController()
    const groupId = activeConversationId
    const get = groupRequestRef.current
    void Promise.allSettled([
      get(`/api/conversations/${groupId}/members`, { signal: controller.signal, cache: 'reload' })
        .then(async response => {
          if (!response.ok) throw new Error('Cannot load group members')
          return response.json() as Promise<GroupMember[]>
        }).then(members => {
          if (!controller.signal.aborted && activeConversationIdRef.current === groupId) setGroupMembers(members)
        }),
      get(`/api/conversations/${groupId}/group-settings`, { signal: controller.signal, cache: 'reload' })
        .then(async response => {
          if (!response.ok) throw new Error('Cannot load group permissions')
          return response.json() as Promise<{ adminCanInvite: boolean; adminCanEditInfo: boolean }>
        }).then(settings => {
          if (!controller.signal.aborted && activeConversationIdRef.current === groupId) setGroupPolicy(settings)
        }),
    ])
    return () => controller.abort()
  }, [activeConversationId, activeConversationType, session?.token, tab, communityWorkspaceOpen, activeConversationIdRef])

  const activeGroupMember = groupMembers.find((item) => item.id === session?.user.id) || null
  const canManageActiveGroup = activeGroupMember?.role === 'owner' || activeGroupMember?.role === 'admin'
  const canInviteActiveGroup = activeGroupMember?.role === 'owner' || (activeGroupMember?.role === 'admin' && groupPolicy?.adminCanInvite === true)
  const canEditGroup = activeGroupMember?.role === 'owner' || (activeGroupMember?.role === 'admin' && groupPolicy?.adminCanEditInfo === true)
  const groupInviteCandidates = useMemo(() => {
    const memberIds = new Set(groupMembers.map((member) => member.id))
    const normalized = groupInviteSearch.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
    return friends
      .filter((friend) => friend.status === 'accepted' && !memberIds.has(friend.id))
      .filter((friend) => !normalized || `${friend.displayName} ${friend.username}`.toLocaleLowerCase('vi-VN').includes(normalized))
      .sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'vi'))
  }, [friends, groupMembers, groupInviteSearch])

  function openGroupSettings(conversation: Conversation) {
    setGroupSettingsOpen(true)
    setGroupInviteSearch('')
    setGroupInviteSelection([])
    setGroupPolicy(null)
    void getGroupSettings(apiFetch, conversation.id)
      .then(async response => {
        if (!response.ok) throw new Error()
        const result = await response.json() as { adminCanInvite: boolean; adminCanEditInfo: boolean }
        if (activeConversationIdRef.current === conversation.id) setGroupPolicy(result)
      }).catch(() => setNotice('Không tải được quyền quản trị nhóm.'))
    void Promise.all([
      refreshGroupMembers(conversation.id),
      refreshFriendConnections(),
    ])
  }

  function launchGroupCall(conversationId: number, mediaType: 'audio' | 'video') {
    window.dispatchEvent(new CustomEvent('chatnet:start-call', {
      detail: { conversationId, mediaType },
    }))
  }

  async function refreshGroupMembers(conversationId = activeConversationId || undefined) {
    if (!conversationId) return
    try {
      const response = await listGroupMembers(apiFetch, conversationId)
      if (!response.ok) return
      const items = (await response.json()) as GroupMember[]
      if (activeConversationIdRef.current === conversationId) {
        setGroupMembers(items)
      }
    } catch {
      setNotice('Không tải được danh sách thành viên nhóm.')
    }
  }

  async function inviteGroupMembers() {
    if (!activeConversationId || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    const selectedUsernames = friends
      .filter((friend) => friend.status === 'accepted' && groupInviteSelection.includes(friend.id))
      .map((friend) => friend.username)
    const usernames = Array.from(new Set(selectedUsernames.map((item) => item.trim().toLowerCase()).filter(Boolean)))
    if (usernames.length === 0) return
    if (usernames.length > 50) {
      setNotice('Mỗi lần có thể mời tối đa 50 người. Hãy chia thành nhiều lượt.', 'warning')
      return
    }
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await addGroupMembers(apiFetch, activeConversationId, usernames)
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không thêm được thành viên')
        return
      }
      if (activeConversationIdRef.current === activeConversationId) {
        setGroupInviteSelection([])
        setGroupInviteSearch('')
      }
      setNotice('Đã thêm thành viên vào nhóm.')
      await Promise.all([refreshGroupMembers(activeConversationId), refreshConversations()])
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
      }
    }
  }

  async function changeGroupMemberRole(member: GroupMember, role: GroupMember['role']) {
    if (!activeConversationId || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    const message = role === 'owner'
      ? `Chuyển quyền chủ nhóm cho @${member.username}?`
      : role === 'admin'
        ? `Đặt @${member.username} làm quản trị viên?`
        : `Gỡ quyền quản trị của @${member.username}?`
    if (!window.confirm(message)) return
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await setGroupMemberRole(apiFetch, activeConversationId, member.id, role)
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không cập nhật được quyền thành viên')
        return
      }
      setNotice(role === 'owner' ? 'Đã chuyển quyền chủ nhóm.' : 'Đã cập nhật quyền thành viên.')
      await refreshGroupMembers(activeConversationId)
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
      }
    }
  }

  async function removeGroupMember(member: GroupMember) {
    if (!activeConversationId || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    const self = member.id === session?.user.id
    if (!window.confirm(self ? 'Rời khỏi nhóm này?' : `Xóa @${member.username} khỏi nhóm?`)) return
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await removeGroupMemberRequest(apiFetch, activeConversationId, member.id)
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || (self ? 'Không rời được nhóm' : 'Không xóa được thành viên'))
        return
      }
      if (self) {
        if (activeConversationIdRef.current === activeConversationId) {
          setGroupSettingsOpen(false)
          setActiveConversationId(null)
        }
        setNotice('Bạn đã rời nhóm.')
        await refreshConversations()
        return
      }
      setNotice(`Đã xóa @${member.username} khỏi nhóm.`)
      await Promise.all([refreshGroupMembers(activeConversationId), refreshConversations()])
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
      }
    }
  }

  return {
    groupSettingsOpen,
    setGroupSettingsOpen,
    groupMembers,
    setGroupMembers,
    groupInviteSearch,
    setGroupInviteSearch,
    groupInviteSelection,
    setGroupInviteSelection,
    groupBusy,
    setGroupBusy,
    activeGroupMember,
    canManageActiveGroup,
    canInviteActiveGroup,
    canEditGroup,
    groupInviteCandidates,
    openGroupSettings,
    launchGroupCall,
    refreshGroupMembers,
    inviteGroupMembers,
    changeGroupMemberRole,
    removeGroupMember,
  }
}