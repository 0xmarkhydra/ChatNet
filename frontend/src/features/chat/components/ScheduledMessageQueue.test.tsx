// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})
const render = (node: ReactNode) => act(async () => root.render(node))
const click = (button: HTMLButtonElement) => act(async () => button.click())
function findButton(name: string) {
  return Array.from(document.querySelectorAll('button')).find(node =>
    (node.getAttribute('aria-label') ?? node.textContent?.trim()) === name)
}
function button(name: string) {
  const node = findButton(name)
  if (!node) throw new Error('Button missing: ' + name)
  return node
}
import { describe, expect, it, vi } from 'vitest'
import ScheduledMessageQueue from './ScheduledMessageQueue'

describe('scheduled message dialog', () => {
  it('creates, moves and cancels only schedules in the open channel', async () => {
    const room = '/api/conversations/42/scheduled-messages'
    const originalAt = new Date(Date.now() + 60 * 60000).toISOString()
    const other = { id: 24, text: 'Kênh khác', sendAt: originalAt, channelId: 3, state: 'pending' }
    let item: { id: number; text: string; sendAt: string; channelId: number; state: string } | null = null
    const request = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const input = JSON.parse(String(init.body))
        item = { id: 5, text: input.text, sendAt: input.sendAt, channelId: input.channelId, state: 'pending' }
        return Response.json(item, { status: 201 })
      }
      if (init?.method === 'PATCH' && item) {
        item.sendAt = JSON.parse(String(init.body)).sendAt
        return Response.json(item)
      }
      if (init?.method === 'DELETE') {
        item = null
        return new Response(null, { status: 204 })
      }
      return Response.json(item ? [item, other] : [other])
    })
    await render(<ScheduledMessageQueue request={request} conversationId={42} channelId={2} initialText="Tin nhắn thử" />)
    await click(button('Tin nhắn hẹn giờ'))
    expect(document.body.textContent).toContain('Chưa có tin nhắn đang chờ.')
    expect(document.body.textContent).not.toContain('Kênh khác')
    await click(button('Lên lịch gửi'))
    expect(document.body.textContent).toContain('Đã lên lịch gửi.')
    expect(document.body.textContent).toContain('Tin nhắn thử')
    const create = request.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(create?.[0]).toBe(room)
    expect(JSON.parse(String(create?.[1]?.body))).toMatchObject({ text: 'Tin nhắn thử', channelId: 2, clientId: expect.any(String) })
    await click(button('Đổi giờ'))
    await click(button('Lưu giờ mới'))
    expect(document.body.textContent).toContain('Đã đổi giờ gửi.')
    await click(button('Hủy lịch'))
    expect(document.body.textContent).not.toContain('Tin nhắn thử')
    expect(request).toHaveBeenCalledWith(room + '/5', { method: 'DELETE' })
  })
})