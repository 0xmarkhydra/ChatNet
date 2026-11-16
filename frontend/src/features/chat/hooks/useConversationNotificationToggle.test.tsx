// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { Conversation } from '../types'
import { useConversationNotificationToggle } from './useConversationNotificationToggle'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

const unmounts: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of unmounts.splice(0)) await cleanup()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

const conversation = { id: 42, muted: false } as Conversation
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function mount(apiFetch: (path: string, init?: RequestInit) => Promise<Response>) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const notify = vi.fn()
  let state!: ReturnType<typeof useConversationNotificationToggle>
  let conversations: Conversation[] = []

  function Test() {
    const [items, setItems] = useState([conversation])
    conversations = items
    state = useConversationNotificationToggle({ apiFetch, setConversations: setItems, setNotice: notify })
    return null
  }

  unmounts.push(async () => { await act(async () => root.unmount()) })
  return {
    render: async () => { await act(async () => root.render(<Test />)) },
    get state() { return state },
    get conversations() { return conversations },
    notify,
  }
}

it('keeps endpoint, payload and response-derived mute state, blocking duplicate requests', async () => {
  const pending = deferred<Response>()
  const apiFetch = vi.fn(() => pending.promise)
  const view = mount(apiFetch)
  await view.render()
  let first!: Promise<void>
  await act(async () => {
    first = view.state.toggleConversationNotifications(conversation)
    await view.state.toggleConversationNotifications(conversation)
  })
  expect(apiFetch).toHaveBeenCalledTimes(1)
  expect(apiFetch).toHaveBeenCalledWith('/api/conversations/42/notification-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageNotifications: false, mentionNotifications: false }),
  })
  expect(view.state.notificationBusyId).toBe(42)
  await act(async () => {
    pending.resolve({ ok: true, json: async () => ({ messageNotifications: false, mentionNotifications: false }) } as Response)
    await first
  })
  expect(view.conversations[0].muted).toBe(true)
  expect(view.state.notificationBusyId).toBeNull()
  expect(view.notify).toHaveBeenCalledWith('Đã tắt thông báo hội thoại.', 'success')
})

it('keeps existing conversation state unchanged on failed responses', async () => {
  const apiFetch = vi.fn(async () => ({
    ok: false, json: async () => ({ error: 'Không có quyền' }),
  }) as Response)
  const view = mount(apiFetch)
  await view.render()
  await act(async () => view.state.toggleConversationNotifications(conversation))
  expect(view.conversations[0].muted).toBe(false)
  expect(view.state.notificationBusyId).toBeNull()
  expect(view.notify).toHaveBeenCalledWith('Không có quyền', 'error')
})
