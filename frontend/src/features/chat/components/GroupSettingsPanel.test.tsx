// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroupSettingsPanel from './GroupSettingsPanel'
import type { Conversation } from '../types'

vi.mock('./GroupGovernancePanel', () => ({ default: () => <div data-testid="governance-panel" /> }))
vi.mock('./GroupManagementDetails', () => ({ default: () => <div data-testid="details-panel" /> }))
vi.mock('./GroupMemberDirectory', () => ({ default: () => <div data-testid="member-directory" /> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  vi.clearAllMocks()
})

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const inviteGroupMembers = vi.fn(async (): Promise<void> => {})
  const props = {
    initialSection: 'members' as 'members' | 'rules',
    activeGroupMember: null,
    setGroupSettingsOpen: vi.fn(),
    canManageActiveGroup: false,
    canInviteActiveGroup: true,
    canEditGroup: false,
    onOpenShared: vi.fn(),
    onOpenMemberProfile: vi.fn(),
    memberFriendRelationship: vi.fn(() => 'none' as const),
    onMemberFriendAction: vi.fn(async () => {}),
    friendBusyIds: new Set<number>(),
    memberViewOpen: false,
    setMemberViewOpen: vi.fn(),
    groupBusy: false,
    activeConversation: {
      id: 41, name: 'Nhóm A', type: 'group', memberCount: 1,
      unreadCount: 0, lastMessage: '', online: false, createdAt: '',
    } as Conversation,
    groupInviteSelection: [7],
    groupInviteSearch: '',
    setGroupInviteSearch: vi.fn(),
    groupInviteCandidates: [],
    friends: [],
    setGroupInviteSelection: vi.fn(),
    inviteGroupMembers,
    groupMembers: [],
    userId: 5,
    changeGroupMemberRole: vi.fn(async () => {}),
    removeGroupMember: vi.fn(async () => {}),
    request: vi.fn(async () => Response.json({})),
    notify: vi.fn(),
    onMembersChanged: vi.fn(async () => {}),
  }
  const render = (changes: Partial<typeof props> = {}) => {
    act(() => root.render(<GroupSettingsPanel {...props} {...changes} />))
  }
  render()
  cleanups.push(() => { act(() => root.unmount()); host.remove() })
  const button = (label: string) => {
    const found = [...host.querySelectorAll('button')].find(el =>
      (el.textContent?.trim() ?? '').includes(label))
    if (!found) throw Error('Missing button: ' + label)
    return found
  }
  return { host, render, button, props, inviteGroupMembers }
}

describe('GroupSettingsPanel lifecycle', () => {
  it('changes the visible section when parent switches initialSection without unmounting', () => {
    const page = mount()
    expect(page.host.querySelector('input[aria-label="Tìm thành viên trong nhóm"]')).not.toBeNull()
    page.render({ initialSection: 'rules' })
    expect(page.host.querySelector('input[aria-label="Tìm thành viên trong nhóm"]')).toBeNull()
    expect(page.host.querySelector('button[aria-current="page"]')?.textContent).toContain('Nội quy nhóm')
    page.render({ initialSection: 'members' })
    expect(page.host.querySelector('input[aria-label="Tìm thành viên trong nhóm"]')).not.toBeNull()
  })

  it('resets member filter when changing groups with the same initial section', () => {
    const page = mount()
    const field = page.host.querySelector('input[aria-label="Tìm thành viên trong nhóm"]') as HTMLInputElement
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'người cũ')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(field.value).toBe('người cũ')
    page.render({ activeConversation: { ...page.props.activeConversation, id: 42, name: 'Nhóm B' } })
    expect((page.host.querySelector('input[aria-label="Tìm thành viên trong nhóm"]') as HTMLInputElement).value).toBe('')
  })

  it('blocks concurrent invitation submissions while groupBusy prop is still false', async () => {
    let resolve!: () => void
    const pending = new Promise<void>(r => { resolve = r })
    const page = mount()
    page.inviteGroupMembers.mockImplementation(async () => pending)
    act(() => {
      page.button('Mời 1 thành viên').click()
      page.button('Mời 1 thành viên').click()
    })
    expect(page.inviteGroupMembers).toHaveBeenCalledOnce()
    await act(async () => { resolve(); await pending })
    page.button('Mời 1 thành viên').click()
    expect(page.inviteGroupMembers).toHaveBeenCalledTimes(2)
  })
})
