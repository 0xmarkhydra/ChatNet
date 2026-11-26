// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import { useConversationCategories } from './useConversationCategories'

const cleanups: Array<() => Promise<void>> = []
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true) })
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  vi.unstubAllGlobals()
})

const flush = () => act(() => new Promise<void>(done => setTimeout(done, 0)))
const account = (sessionId: string) => ({ sessionId, token: 'token-' + sessionId }) as Session

function deferred() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(done => { resolve = done })
  return { promise, resolve }
}

function mount(handler: (path: string, init?: RequestInit) => Promise<Response>) {
  const root = createRoot(document.createElement('div'))
  const sessionRef = { current: null as Session | null }
  const request = vi.fn(handler)
  let state!: ReturnType<typeof useConversationCategories>
  const renders: Array<ReturnType<typeof useConversationCategories>> = []
  function Probe({ session }: { session: Session | null }) {
    // A new apiFetch and new callbacks on every render must not trigger a reload.
    state = useConversationCategories({
      session, sessionRef, apiFetch: (path: string, init?: RequestInit) => request(path, init),
      mergeConversations: () => {}, setCategory: () => {}, clearCategory: () => {},
      setStatus: () => {}, setNotice: () => {},
    })
    renders.push(state)
    return null
  }
  const render = async (session: Session | null) => {
    sessionRef.current = session
    await act(async () => root.render(<Probe session={session} />))
    await flush()
  }
  cleanups.push(async () => { await act(async () => root.unmount()) })
  const categoryLoads = () => request.mock.calls.filter(([path, init]) =>
    path === '/api/conversation-categories' && !init?.method).length
  return { render, renders, categoryLoads, get state() { return state } }
}

it('loads categories once per session, not on every rerender', async () => {
  const view = mount(async () => Response.json([]))
  await view.render(null)
  expect(view.categoryLoads()).toBe(0)
  const session = account('a')
  await view.render(session)
  await view.render(session)
  await view.render({ ...session })
  expect(view.categoryLoads()).toBe(1)
  await view.render(account('b'))
  await view.render(account('b'))
  expect(view.categoryLoads()).toBe(2)
})

it('resets the previous session categories, selection and errors for a new session', async () => {
  let sessionBLoading = false
  const view = mount(async path => {
    if (sessionBLoading) return new Promise<Response>(() => {})
    if (path === '/api/conversation-categories') return Response.json([{ id: 7, name: 'Work', color: 'red' }])
    return new Response(null, { status: 500 })
  })
  await view.render(account('a'))
  await act(async () => view.state.select(7))
  await flush()
  expect(view.state.categories).toHaveLength(1)
  expect(view.state.selected).toBe(7)
  expect(view.state.listError).not.toBe('')

  sessionBLoading = true
  view.renders.length = 0
  await view.render(account('b'))
  expect(view.renders.at(-1)).toMatchObject({
    categories: [], selected: null, items: [], hasMore: false,
    loading: false, busy: false, error: '', listError: '',
  })
})

it('releases busy state on session change and ignores the previous session late responses', async () => {
  const oldList = deferred()
  const oldSave = deferred()
  const newSave = deferred()
  let lists = 0
  let saves = 0
  const view = mount((_path, init) => {
    if (init?.method === 'POST') return (++saves === 1 ? oldSave : newSave).promise
    return ++lists === 1 ? oldList.promise : Promise.resolve(Response.json([]))
  })
  await view.render(account('a'))
  let first!: Promise<boolean>
  await act(async () => { first = view.state.save({ name: 'Old', color: 'red' }) })
  expect(view.state.busy).toBe(true)

  await view.render(account('b'))
  expect(view.state.busy).toBe(false)
  let second!: Promise<boolean>
  await act(async () => { second = view.state.save({ name: 'New', color: 'blue' }) })
  expect(saves).toBe(2)
  expect(view.state.busy).toBe(true)

  await act(async () => {
    oldList.resolve(Response.json([{ id: 1, name: 'Old list', color: 'red' }]))
    oldSave.resolve(Response.json({ id: 2, name: 'Old', color: 'red' }))
    expect(await first).toBe(false)
  })
  await flush()
  expect(view.state.categories).toEqual([])
  expect(view.state.busy).toBe(true)

  await act(async () => {
    newSave.resolve(Response.json({ id: 3, name: 'New', color: 'blue' }))
    expect(await second).toBe(true)
  })
  expect(view.state.categories).toEqual([{ id: 3, name: 'New', color: 'blue' }])
  expect(view.state.busy).toBe(false)
})
