// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import GroupGovernancePanel from './GroupGovernancePanel'

const mocks = vi.hoisted(() => ({
  settings: vi.fn(), invites: vi.fn(), requests: vi.fn(), audit: vi.fn(),
  create: vi.fn(), update: vi.fn(), revoke: vi.fn(), review: vi.fn(),
}))
vi.mock('../api/groups', () => ({ getGroupSettings: mocks.settings }))
vi.mock('../api/governance', () => ({
  listInvites: mocks.invites,
  listJoinRequests: mocks.requests,
  listAuditLog: mocks.audit,
  createInvite: mocks.create,
  updateGroupSettings: mocks.update,
  revokeInvite: mocks.revoke,
  reviewJoinRequest: mocks.review,
}))
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

const settings = { requireApproval: false, adminCanInvite: true, adminCanApprove: true, adminCanEditInfo: true }
const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response
const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  mocks.settings.mockReset().mockResolvedValue(response(settings))
  mocks.invites.mockReset().mockResolvedValue(response([]))
  mocks.requests.mockReset().mockResolvedValue(response([]))
  mocks.audit.mockReset().mockResolvedValue(response([]))
  mocks.create.mockReset()
  mocks.update.mockReset().mockResolvedValue(response(settings))
  mocks.revoke.mockReset()
  mocks.review.mockReset().mockResolvedValue(response({}))
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  document.body.innerHTML = ''
})
async function mount(role: 'owner' | 'admin' | 'member', section: 'permissions' | 'requests' | 'activity' = 'permissions') {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(async () => response({}))
  const notify = vi.fn()
  const onMembersChanged = vi.fn(async () => {})
  await act(async () => {
    root.render(<GroupGovernancePanel conversationId={49} role={role} section={section}
      request={request} notify={notify} onMembersChanged={onMembersChanged} />)
  })
  cleanups.push(async () => { await act(async () => root.unmount()) })
  return { host, request, notify, onMembersChanged }
}

it('preserves the permission form and persists the changed owner setting', async () => {
  const view = await mount('owner')
  const first = view.host.querySelector<HTMLInputElement>('input[type="checkbox"]')
  expect(first?.checked).toBe(false)
  await act(async () => { first?.click() })
  expect(first?.checked).toBe(true)
  const save = Array.from(view.host.querySelectorAll('button'))
    .find(button => button.textContent?.includes('Lưu quyền nhóm'))
  await act(async () => { save?.click() })
  expect(mocks.update).toHaveBeenCalledWith(view.request, 49, { ...settings, requireApproval: true })
  expect(view.notify).toHaveBeenCalledWith('Đã lưu thiết lập và quyền quản trị nhóm.')
})

it('renders pending requests and removes an approved member request without changing labels', async () => {
  mocks.requests.mockResolvedValue(response([{
    id: 67, userId: 123, username: 'newmember', displayName: 'Thành viên mới', createdAt: '2026-11-16',
  }]))
  const view = await mount('owner', 'requests')
  expect(view.host.textContent).toContain('Thành viên mới')
  const approve = Array.from(view.host.querySelectorAll('button'))
    .find(button => button.textContent?.trim() === 'Duyệt')
  await act(async () => { approve?.click() })
  expect(mocks.review).toHaveBeenCalledWith(view.request, 49, 67, true)
  expect(view.onMembersChanged).toHaveBeenCalledTimes(1)
  expect(view.host.textContent).not.toContain('Thành viên mới')
  expect(view.notify).toHaveBeenCalledWith('Đã phê duyệt thành viên.')
})

it('does not show governance controls to ordinary group members', async () => {
  const view = await mount('member')
  expect(view.host.querySelector('.group-governance')).toBeNull()
  expect(view.host.querySelector('button')).toBeNull()
})
