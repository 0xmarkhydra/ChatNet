// @vitest-environment jsdom
import { act, type Dispatch, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, GroupMember } from '../types'
import GroupSettingsPanel from './GroupSettingsPanel'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

const mounts: Array<() => void> = []

afterEach(() => {
  while (mounts.length) mounts.pop()!()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

it('restores focus to the member trigger that opened the menu', async () => {
  const members: GroupMember[] = [
    { id: 1, username: 'an', displayName: 'An', role: 'owner', online: false },
    { id: 2, username: 'binh', displayName: 'Bình', role: 'member', online: false },
  ]
  const conversation: Conversation = {
    id: 42, type: 'group', name: 'Nhóm thử nghiệm', memberCount: 2, unreadCount: 0,
    lastMessage: '', online: false, createdAt: '2026-01-01T00:00:00Z',
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  mounts.push(() => { act(() => root.unmount()); host.remove() })
  const setGroupInviteSelection: Dispatch<SetStateAction<number[]>> = vi.fn()
  await act(async () => root.render(
    <GroupSettingsPanel
      activeGroupMember={members[0]}
      setGroupSettingsOpen={vi.fn()}
      canManageActiveGroup
      canInviteActiveGroup={false}
      canEditGroup={false}
      onOpenShared={vi.fn()}
      onOpenMemberProfile={vi.fn()}
      memberFriendRelationship={() => 'none'}
      onMemberFriendAction={async () => {}}
      friendBusyIds={new Set()}
      memberViewOpen
      setMemberViewOpen={vi.fn()}
      groupBusy={false}
      activeConversation={conversation}
      groupInviteSelection={[]}
      groupInviteSearch=""
      setGroupInviteSearch={vi.fn()}
      groupInviteCandidates={[]}
      friends={[]}
      setGroupInviteSelection={setGroupInviteSelection}
      inviteGroupMembers={async () => {}}
      groupMembers={members}
      userId={99}
      changeGroupMemberRole={async () => {}}
      removeGroupMember={async () => {}}
      request={async () => new Response()}
      notify={vi.fn()}
      onMembersChanged={async () => {}}
    />,
  ))

  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Tùy chọn của An"]')
  expect(trigger).not.toBeNull()
  await act(async () => trigger?.click())
  expect(trigger?.getAttribute('aria-expanded')).toBe('true')
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.activeElement).toBe(trigger)
})
