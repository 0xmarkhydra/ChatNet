// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import { useGroupManagement } from './useGroupManagement'

const cleanups: Array<() => Promise<void>> = []
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true) })
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  vi.unstubAllGlobals()
})

const flush = () => act(() => new Promise<void>(done => setTimeout(done, 0)))
const session = { sessionId: 'a', token: 'token-a', user: { id: 1 } } as Session
const admin = [{ id: 1, username: 'me', displayName: 'Me', role: 'admin' }]
const policy = { adminCanInvite: true, adminCanEditInfo: true }

function mount() {
  const root = createRoot(document.createElement('div'))
  const sessionRef = { current: session as Session | null }
  const activeConversationIdRef = { current: 10 as number | null }
  const jobs: Array<{ path: string; resolve: (value: Response) => void }> = []
  const request = vi.fn((path: string) => new Promise<Response>(resolve => { jobs.push({ path, resolve }) }))
  let state!: ReturnType<typeof useGroupManagement>
  const renders: Array<{ id: number; members: number; invite: boolean; edit: boolean }> = []
  function Probe({ id }: { id: number }) {
    state = useGroupManagement({
      session, sessionRef, tab: 'chat', communityWorkspaceOpen: false,
      activeConversationId: id, activeConversationType: 'group', activeConversationIdRef,
      friends: [], apiFetch: (path: string) => request(path),
      refreshFriendConnections: async () => {}, refreshConversations: async () => {},
      setActiveConversationId: () => {}, setNotice: () => {}, actionLocks: { current: new Set() },
    })
    renders.push({ id, members: state.groupMembers.length,
      invite: state.canInviteActiveGroup, edit: state.canEditGroup })
    return null
  }
  const render = async (id: number) => {
    activeConversationIdRef.current = id
    await act(async () => root.render(<Probe id={id} />))
  }
  const respond = async (path: string, body: unknown) => {
    const index = jobs.findIndex(job => job.path === path)
    expect(index).toBeGreaterThanOrEqual(0)
    const [job] = jobs.splice(index, 1)
    await act(async () => job.resolve(Response.json(body)))
    await flush()
  }
  cleanups.push(async () => { await act(async () => root.unmount()) })
  return { render, respond, renders, request, get state() { return state } }
}

it('does not refetch or reset members and policy on an unrelated rerender', async () => {
  const view = mount()
  await view.render(10)
  await view.respond('/api/conversations/10/members', admin)
  await view.respond('/api/conversations/10/group-settings', policy)
  await view.render(10)
  expect(view.request).toHaveBeenCalledTimes(2)
  expect(view.state.groupMembers).toHaveLength(1)
  expect(view.state.canInviteActiveGroup).toBe(true)
})

it('resets members and policy when the conversation changes, including on return', async () => {
  const view = mount()
  await view.render(10)
  await view.respond('/api/conversations/10/members', admin)
  await view.respond('/api/conversations/10/group-settings', policy)
  expect(view.state.canEditGroup).toBe(true)

  view.renders.length = 0
  await view.render(20)
  expect(view.renders.at(-1)).toEqual({ id: 20, members: 0, invite: false, edit: false })

  // The same admin loads in the next group: the old policy must not grant anything.
  await view.respond('/api/conversations/20/members', admin)
  expect(view.state.groupMembers).toHaveLength(1)
  expect(view.state.canInviteActiveGroup).toBe(false)
  expect(view.state.canEditGroup).toBe(false)

  await view.render(10)
  expect(view.state.groupMembers).toEqual([])
  expect(view.state.canEditGroup).toBe(false)
})

it('ignores late members and policy from the previous conversation', async () => {
  const view = mount()
  await view.render(10)
  await view.render(20)
  await view.respond('/api/conversations/10/members', admin)
  await view.respond('/api/conversations/10/group-settings', policy)
  expect(view.state.groupMembers).toEqual([])
  await view.respond('/api/conversations/20/members', admin)
  expect(view.state.canInviteActiveGroup).toBe(false)
})
