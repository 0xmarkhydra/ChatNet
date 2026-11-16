// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGroupGovernanceController } from './useGroupGovernanceController'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(), invites: vi.fn(), requests: vi.fn(), audit: vi.fn(),
  create: vi.fn(), update: vi.fn(), revoke: vi.fn(), review: vi.fn(),
}))
vi.mock('../api/groups', () => ({ getGroupSettings: mocks.getSettings }))
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
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  mocks.getSettings.mockReset().mockResolvedValue(response(settings))
  mocks.invites.mockReset().mockResolvedValue(response([]))
  mocks.requests.mockReset().mockResolvedValue(response([]))
  mocks.audit.mockReset().mockResolvedValue(response([]))
  mocks.create.mockReset()
  mocks.update.mockReset()
  mocks.revoke.mockReset()
  mocks.review.mockReset()
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  document.body.innerHTML = ''
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { resolve, promise }
}
function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(async () => response({}))
  const notify = vi.fn()
  const onMembersChanged = vi.fn(async () => {})
  let state!: ReturnType<typeof useGroupGovernanceController>
  function Test({ group }: { group: number }) {
    state = useGroupGovernanceController({
      conversationId: group, role: 'owner', request, notify, onMembersChanged,
    })
    return null
  }
  const render = async (group: number) => {
    await act(async () => root.render(<Test group={group} />))
  }
  cleanups.push(async () => { await act(async () => root.unmount()) })
  return { render, get state() { return state }, request, notify, onMembersChanged }
}

it('isolates settings and audit from a previous group when responses arrive out of order', async () => {
  const oldSettings = deferred<Response>()
  const oldAudit = deferred<Response>()
  mocks.getSettings.mockImplementationOnce(() => oldSettings.promise)
    .mockResolvedValueOnce(response({ ...settings, requireApproval: true }))
  mocks.audit.mockImplementationOnce(() => oldAudit.promise)
    .mockResolvedValueOnce(response([{ id: 200, action: 'group.renamed' }]))
  const view = mount()
  await view.render(1)
  await view.render(2)
  expect(view.state.settings.requireApproval).toBe(true)
  expect(view.state.audit).toHaveLength(1)
  await act(async () => {
    oldSettings.resolve(response({ ...settings, requireApproval: false }))
    oldAudit.resolve(response([{ id: 100, action: 'member.added' }]))
  })
  expect(view.state.settings.requireApproval).toBe(true)
  expect(view.state.audit[0].id).toBe(200)
  expect(mocks.getSettings.mock.calls.map(call => call[1])).toEqual([1, 2])
})

it('prevents duplicate invite creation before busy state re-renders and refreshes audit on success', async () => {
  const pending = deferred<Response>()
  mocks.create.mockReturnValue(pending.promise)
  const view = mount()
  await view.render(42)
  let first!: Promise<void>
  await act(async () => {
    first = view.state.createInvite()
    await view.state.createInvite()
  })
  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.create).toHaveBeenCalledWith(view.request, 42, { expiresInHours: 24, maxUses: 0 })
  expect(view.state.busy).toBe(true)
  await act(async () => {
    pending.resolve(response({ token: 'test-invite-token' }))
    await first
  })
  expect(view.state.busy).toBe(false)
  expect(view.state.createdUrl).toContain('groupInvite=test-invite-token')
  expect(view.notify).toHaveBeenCalledWith('Đã tạo link mời tham gia nhóm.')
  expect(mocks.invites).toHaveBeenCalledTimes(2)
  expect(mocks.audit).toHaveBeenCalledTimes(2)
})

it('appends another audit page with the last item cursor and stops when page is short', async () => {
  const initial = Array.from({ length: 50 }, (_, index) => ({ id: 100 - index, actor: 'owner', action: 'member.added' }))
  mocks.audit.mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(response([{ id: 50, actor: 'owner', action: 'member.left' }]))
  const view = mount()
  await view.render(7)
  expect(view.state.audit).toHaveLength(50)
  await act(async () => view.state.loadMoreAudit())
  expect(mocks.audit).toHaveBeenLastCalledWith(view.request, 7, 51)
  expect(view.state.audit).toHaveLength(51)
  expect(view.state.before).toBe(0)
  expect(view.state.busy).toBe(false)
})

it('does not expose an invite token or notify after switching to another group', async () => {
  const pending = deferred<Response>()
  mocks.create.mockReturnValue(pending.promise)
  const view = mount()
  await view.render(10)
  let mutation!: Promise<void>
  await act(async () => { mutation = view.state.createInvite() })
  expect(view.state.busy).toBe(true)

  await view.render(11)
  expect(view.state.createdUrl).toBe('')
  expect(view.state.busy).toBe(false)
  await act(async () => {
    pending.resolve(response({ token: 'stale-secret' }))
    await mutation
  })
  expect(view.state.createdUrl).toBe('')
  expect(view.notify).not.toHaveBeenCalled()
  expect(mocks.invites.mock.calls.map(call => call[1])).toEqual([10, 11])
})

it('does not refresh members from a completed approval belonging to the previous group', async () => {
  const pending = deferred<Response>()
  mocks.review.mockReturnValue(pending.promise)
  const view = mount()
  await view.render(1)
  let mutation!: Promise<void>
  await act(async () => {
    mutation = view.state.review({
      id: 77, userId: 5, username: 'member', displayName: 'Member', createdAt: '',
    }, true)
  })
  await view.render(2)
  await act(async () => {
    pending.resolve(response({}))
    await mutation
  })
  expect(view.onMembersChanged).not.toHaveBeenCalled()
  expect(view.notify).not.toHaveBeenCalled()
  expect(view.state.busy).toBe(false)
})

it('releases the mutation guard when the backend rejects an invite request', async () => {
  mocks.create.mockResolvedValueOnce(response({ error: 'Hết quyền mời' }, false))
    .mockResolvedValueOnce(response({ token: 'allowed' }))
  const view = mount()
  await view.render(9)
  await act(async () => view.state.createInvite())
  expect(view.state.error).toBe('Hết quyền mời')
  expect(view.state.busy).toBe(false)
  await act(async () => view.state.createInvite())
  expect(mocks.create).toHaveBeenCalledTimes(2)
  expect(view.state.error).toBe('')
  expect(view.state.createdUrl).toContain('groupInvite=allowed')
})
