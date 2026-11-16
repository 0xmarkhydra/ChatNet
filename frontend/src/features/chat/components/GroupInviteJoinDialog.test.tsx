// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import GroupInviteJoinDialog from './GroupInviteJoinDialog'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), join: vi.fn() }))
vi.mock('../api/invites', () => ({
  previewGroupInvite: mocks.preview,
  joinGroupInvite: mocks.join,
}))
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

const preview = {
  conversationId: 48,
  name: 'Nhóm kiểm thử',
  memberCount: 4,
  requireApproval: false,
  expiresAt: '2027-12-01T00:00:00Z',
  isMember: false,
  pending: false,
}
const response = (value: unknown, ok = true) => ({ ok, json: async () => value }) as Response
const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  window.history.replaceState({}, '', '/chat?groupInvite=secret-token')
  mocks.preview.mockReset().mockResolvedValue(response(preview))
  mocks.join.mockReset()
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  document.body.innerHTML = ''
  window.history.replaceState({}, '', '/')
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { resolve, promise }
}
async function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(async () => response({}))
  const notify = vi.fn()
  const onJoined = vi.fn(async () => {})
  await act(async () => {
    root.render(<GroupInviteJoinDialog request={request} notify={notify} onJoined={onJoined} />)
  })
  cleanups.push(async () => { await act(async () => root.unmount()) })
  const actions = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.group-join-actions button'))
  return { host, actions, request, notify, onJoined }
}

it('removes invite secret from history, prevents duplicate joins and keeps success behavior', async () => {
  const pending = deferred<Response>()
  mocks.join.mockReturnValue(pending.promise)
  const view = await mount()
  expect(window.location.search).toBe('')
  expect(mocks.preview).toHaveBeenCalledWith(view.request, 'secret-token')
  expect(view.host.textContent).toContain(preview.name)
  await act(async () => {
    view.actions()[1].click()
    view.actions()[1].click()
  })
  expect(mocks.join).toHaveBeenCalledTimes(1)
  expect(mocks.join).toHaveBeenCalledWith(view.request, 'secret-token')
  await act(async () => {
    pending.resolve(response({ status: 'member', conversationId: 75 }))
    await pending.promise
  })
  expect(view.onJoined).toHaveBeenCalledWith(75)
  expect(view.notify).toHaveBeenCalledWith('Đã tham gia nhóm thành công.')
  expect(view.host.querySelector('[role="dialog"]')).toBeNull()
})

it('ignores a join result after the dialog was dismissed', async () => {
  const pending = deferred<Response>()
  mocks.join.mockReturnValue(pending.promise)
  const view = await mount()
  await act(async () => { view.actions()[1].click() })
  await act(async () => { view.actions()[0].click() })
  expect(view.host.querySelector('[role="dialog"]')).toBeNull()
  await act(async () => {
    pending.resolve(response({ status: 'member', conversationId: 75 }))
    await pending.promise
  })
  expect(view.onJoined).not.toHaveBeenCalled()
  expect(view.notify).not.toHaveBeenCalled()
})

it('shows an invalid-link error and never submits a join without a valid preview', async () => {
  mocks.preview.mockResolvedValue(response({ error: 'expired' }, false))
  const view = await mount()
  expect(view.host.querySelector('[role="alert"]')?.textContent).toContain('hết hạn')
  expect(view.actions()).toHaveLength(1)
  expect(mocks.join).not.toHaveBeenCalled()
})

it('opens existing membership without sending a join mutation', async () => {
  mocks.preview.mockResolvedValue(response({ ...preview, isMember: true }))
  const view = await mount()
  await act(async () => { view.actions()[1].click() })
  expect(view.onJoined).toHaveBeenCalledWith(48)
  expect(mocks.join).not.toHaveBeenCalled()
  expect(view.host.querySelector('[role="dialog"]')).toBeNull()
})
