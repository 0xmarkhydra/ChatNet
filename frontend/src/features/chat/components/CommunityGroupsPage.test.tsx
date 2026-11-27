// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CommunityGroupsPage from './CommunityGroupsPage'
import type { Conversation } from '../types'

const cleanups: Array<() => Promise<void>> = []
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true) })
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  vi.unstubAllGlobals()
})

const flush = () => act(() => new Promise<void>(done => setTimeout(done, 0)))
const group = (id: number) => ({ id, type: 'group', name: 'Group ' + id, memberCount: 1, unreadCount: 0 }) as Conversation
const channelMessage = (id: number, channelId: number, text: string) => ({
  id, conversationId: 1, channelId, senderId: 9, sender: 'other', text, createdAt: '2026-11-15T00:00:00Z',
})

async function mount({ failMetadata = false } = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const sends: Array<(response: Response) => void> = []
  const request = vi.fn((path: string, init?: RequestInit): Promise<Response> => {
    if (init?.method === 'POST') return new Promise(resolve => { sends.push(resolve) })
    const groupId = Number(path.split('/')[3])
    if (path.endsWith('/channels')) return Promise.resolve(Response.json(
      [1, 2].map(n => ({ id: groupId * 10 + n, conversationId: groupId, name: `room-${groupId}-${n}`, description: '' }))))
    if (path.endsWith('/community')) return Promise.resolve(failMetadata ? new Response(null, { status: 500 })
      : Response.json({ description: '', topic: 'topic-' + groupId, rules: '', visibility: 'private' }))
    if (path.includes('/messages?')) {
      const channelId = Number(/channelId=(\d+)/.exec(path)![1])
      return Promise.resolve(Response.json([channelMessage(channelId, channelId, 'history-' + channelId)]))
    }
    return Promise.resolve(Response.json({ messageNotifications: true, mentionNotifications: true }))
  })
  const notify = vi.fn()
  const render = async (groupId: number) => {
    const props = {
      mode: 'channel', selectedGroup: group(groupId), groups: [], userId: 1, myName: 'Me', members: [],
      activeMember: null, canEdit: false, messages: [], pendingMessages: [], chatOnline: true, messageText: '',
      inviteCandidates: [], inviteSelection: [], inviteSearch: '',
      // New function identities on every render.
      request: (path: string, init?: RequestInit) => request(path, init),
      notify: (text: string) => notify(text),
    } as unknown as ComponentProps<typeof CommunityGroupsPage>
    await act(async () => root.render(<CommunityGroupsPage {...props} />))
    await flush()
  }
  await render(1)
  cleanups.push(async () => { await act(async () => root.unmount()); host.remove() })
  const open = async (name: string) => {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>('.cg-channel-link'))
      .find(x => x.textContent === name)
    expect(button, name).toBeTruthy()
    await act(async () => button!.click())
    await flush()
  }
  const textarea = () => host.querySelector('textarea')!
  const type = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea(), value)
    textarea().dispatchEvent(new Event('input', { bubbles: true }))
  })
  const submit = async () => act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  const log = () => host.querySelector('[role="log"]')!.textContent!
  const finishSend = async (response: Response) => { await act(async () => sends[0](response)); await flush() }
  return { host, render, open, type, submit, log, textarea, finishSend, sends, request, notify }
}

type View = Awaited<ReturnType<typeof mount>>

it('does not refetch group or channel data when notify and request identities change', async () => {
  const view = await mount({ failMetadata: true })
  await view.open('room-1-1')
  expect(view.request).toHaveBeenCalledTimes(4)
  await view.render(1)
  await view.render(1)
  expect(view.request).toHaveBeenCalledTimes(4)
  expect(view.notify).toHaveBeenCalledTimes(1)
  expect(view.log()).toContain('history-11')
})

it('resets channel messages and the pending send when switching channels', async () => {
  const view = await mount()
  await view.open('room-1-1')
  await view.type('unconfirmed text')
  await view.submit()
  expect(view.log()).toContain('history-11')
  expect(view.log()).toContain('Chờ xác nhận')
  await view.open('room-1-2')
  expect(view.log()).toContain('history-12')
  expect(view.log()).not.toContain('history-11')
  expect(view.log()).not.toContain('Chờ xác nhận')
})

it('resets channel selection, list, metadata and draft when switching groups, including on return', async () => {
  const view = await mount()
  await view.open('room-1-1')
  await view.type('draft for group one')
  await view.render(2)
  expect(view.host.textContent).toContain('room-2-1')
  expect(view.host.textContent).not.toContain('room-1-1')
  expect(view.host.textContent).toContain('topic-2')
  expect(view.host.textContent).not.toContain('topic-1')
  expect(view.host.querySelector('.cg-channel-link.active')?.textContent).toBe('Thảo luận chung')
  expect(view.log()).not.toContain('history-11')
  await view.open('room-2-1')
  expect(view.textarea().value).toBe('')
  await view.render(1)
  expect(view.host.querySelector('.cg-channel-link.active')?.textContent).toBe('Thảo luận chung')
  await view.open('room-1-1')
  expect(view.textarea().value).toBe('')
})

it.each([
  ['another channel', async (view: View) => { await view.open('room-1-2') }, 'history-12'],
  ['another group', async (view: View) => { await view.render(2); await view.open('room-2-1') }, 'history-21'],
])('keeps a late channel send out of %s', async (_label, leave, expected) => {
  const view = await mount()
  await view.open('room-1-1')
  await view.type('late message')
  await view.submit()
  expect(view.sends).toHaveLength(1)
  await leave(view)
  await view.finishSend(Response.json(channelMessage(999, 11, 'late message')))
  expect(view.log()).toContain(expected)
  expect(view.log()).not.toContain('late message')
  expect(view.log()).not.toContain('Chờ xác nhận')
})
