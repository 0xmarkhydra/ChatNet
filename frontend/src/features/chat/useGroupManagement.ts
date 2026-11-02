import { useState, useEffect, useMemo, type RefObject } from 'react'
import type { Session } from '../auth/session'
import type { Tab } from '../../app/types'
import type { FriendConnection } from '../contacts/types'
import type { Conversation, GroupMember } from './types'
import type { ToastKind } from '../notifications/toast'

type Options = {
  session: Session | null
  sessionRef: RefObject<Session | null>
  tab: Tab
  activeConversationId: number | null
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
  activeConversationId,
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
  const [groupActionsOpen, setGroupActionsOpen] = useState(false)
  useEffect(() => setGroupActionsOpen(false), [activeConversationId, tab])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [groupInviteDraft, setGroupInviteDraft] = useState('')
  const [groupInviteSearch, setGroupInviteSearch] = useState('')
  const [groupInviteSelection, setGroupInviteSelection] = useState<number[]>([])
  const [groupBusy, setGroupBusy] = useState(false)

  const activeGroupMember = groupMembers.find((item) => item.id === session?.user.id) || null
  const canManageActiveGroup = activeGroupMember?.role === 'owner' || activeGroupMember?.role === 'admin'
  const groupInviteCandidates = useMemo(() => {
    const memberIds = new Set(groupMembers.map((member) => member.id))
    const normalized = groupInviteSearch.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
    return friends
      .filter((friend) => friend.status === 'accepted' && !memberIds.has(friend.id))
      .filter((friend) => !normalized || `${friend.displayName} ${friend.username}`.toLocaleLowerCase('vi-VN').includes(normalized))
      .sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'vi'))
  }, [friends, groupMembers, groupInviteSearch])

  function openGroupSettings(conversation: Conversation) {
    setGroupActionsOpen(false)
    setGroupSettingsOpen(true)
    setGroupNameDraft(conversation.name)
    setGroupInviteSearch('')
    setGroupInviteSelection([])
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
      const response = await apiFetch(`/api/conversations/${conversationId}/members`)
      if (!response.ok) return
      const items = (await response.json()) as GroupMember[]
      if (activeConversationIdRef.current === conversationId) {
        setGroupMembers(items)
      }
    } catch {
      setNotice('Không tải được danh sách thành viên nhóm.')
    }
  }

  async function renameActiveGroup() {
    if (!activeConversationId || !groupNameDraft.trim() || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupNameDraft.trim() }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không đổi được tên nhóm')
        return
      }
      setNotice('Đã cập nhật tên nhóm.')
      await refreshConversations()
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
      }
    }
  }

  async function inviteGroupMembers() {
    if (!activeConversationId || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    const selectedUsernames = friends
      .filter((friend) => friend.status === 'accepted' && groupInviteSelection.includes(friend.id))
      .map((friend) => friend.username)
    const usernames = Array.from(new Set([
      ...selectedUsernames,
      ...groupInviteDraft.split(/[\s,;]+/),
    ].map((item) => item.trim().replace(/^@/, '').toLowerCase()).filter(Boolean)))
    if (usernames.length === 0) return
    if (usernames.length > 50) {
      setNotice('Mỗi lần có thể mời tối đa 50 người. Hãy chia thành nhiều lượt.', 'warning')
      return
    }
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không thêm được thành viên')
        return
      }
      if (activeConversationIdRef.current === activeConversationId) {
        setGroupInviteDraft((current) => current === groupInviteDraft ? '' : current)
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
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
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
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members/${member.id}`, {
        method: 'DELETE',
      })
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
    groupActionsOpen,
    setGroupActionsOpen,
    groupMembers,
    setGroupMembers,
    groupNameDraft,
    setGroupNameDraft,
    groupInviteDraft,
    setGroupInviteDraft,
    groupInviteSearch,
    setGroupInviteSearch,
    groupInviteSelection,
    setGroupInviteSelection,
    groupBusy,
    setGroupBusy,
    activeGroupMember,
    canManageActiveGroup,
    groupInviteCandidates,
    openGroupSettings,
    launchGroupCall,
    refreshGroupMembers,
    renameActiveGroup,
    inviteGroupMembers,
    changeGroupMemberRole,
    removeGroupMember,
  }
}
