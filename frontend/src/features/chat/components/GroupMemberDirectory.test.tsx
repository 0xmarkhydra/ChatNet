// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroupMemberDirectory from './GroupMemberDirectory'
import type { GroupMember } from '../types'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const owner: GroupMember = { id: 1, username: 'owner', displayName: 'Chủ nhóm', role: 'owner', online: true }
const member: GroupMember = { id: 2, username: 'member', displayName: 'Thành viên B', role: 'member', online: false }
const otherAdmin: GroupMember = { id: 3, username: 'admin', displayName: 'Quản trị C', role: 'admin', online: true }
const mounted: Array<() => void> = []

afterEach(() => {
  while (mounted.length) mounted.pop()!()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(role: GroupMember['role'] = 'owner') {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onMemberFriendAction = vi.fn(async () => {})
  const changeGroupMemberRole = vi.fn(async () => {})
  const removeGroupMember = vi.fn(async () => {})
  const setMemberViewOpen = vi.fn()
  const notify = vi.fn()
  const activeGroupMember = role === 'owner' ? owner : role === 'admin' ? otherAdmin : member
  const render = (key = 'A') => act(() => root.render(
    <GroupMemberDirectory key={key} activeGroupMember={activeGroupMember}
      canManageActiveGroup={role !== 'member'} onOpenMemberProfile={vi.fn()}
      memberFriendRelationship={() => 'none'}
      onMemberFriendAction={onMemberFriendAction} friendBusyIds={new Set<number>()}
      setMemberViewOpen={setMemberViewOpen} groupBusy={false}
      groupMembers={[owner, member, otherAdmin]} userId={activeGroupMember.id}
      changeGroupMemberRole={changeGroupMemberRole} removeGroupMember={removeGroupMember}
      notify={notify}
    />,
  ))
  render()
  mounted.push(() => { act(() => root.unmount()); host.remove() })
  const click = (name: string) => {
    const button = [...host.querySelectorAll('button')].find(el => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name)
    if (!button) throw new Error('Button missing: ' + name)
    act(() => button.click())
  }
  const escape = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  return { host, click, escape, render, changeGroupMemberRole, removeGroupMember, setMemberViewOpen, notify }
}

describe('GroupMemberDirectory responsibilities', () => {
  it('allows owner actions and closes member menu before navigating back on Escape', () => {
    const page = setup()
    page.click('Tùy chọn của Thành viên B')
    expect(page.host.querySelector('[role="menu"]')).not.toBeNull()
    expect(page.host.textContent).toContain('Đặt làm admin')
    page.escape()
    expect(page.host.querySelector('[role="menu"]')).toBeNull()
    expect(page.setMemberViewOpen).not.toHaveBeenCalled()
    page.escape()
    expect(page.setMemberViewOpen).toHaveBeenCalledWith(false)
    page.click('Tùy chọn của Thành viên B')
    page.click('Đặt làm admin')
    expect(page.changeGroupMemberRole).toHaveBeenCalledWith(member, 'admin')
  })

  it('does not expose owner actions to a regular member and preserves leaving group', () => {
    const page = setup('member')
    page.click('Tùy chọn của Thành viên B')
    expect(page.host.textContent).toContain('Rời nhóm')
    expect(page.host.textContent).not.toContain('Chuyển quyền chủ nhóm')
    page.click('Rời nhóm')
    expect(page.removeGroupMember).toHaveBeenCalledWith(member)
  })

  it('resets an open menu when the directory identity changes', () => {
    const page = setup()
    page.click('Tùy chọn của Thành viên B')
    expect(page.host.querySelector('[role="menu"]')).not.toBeNull()
    page.render('B')
    expect(page.host.querySelector('[role="menu"]')).toBeNull()
  })
})
