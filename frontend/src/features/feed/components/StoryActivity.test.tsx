// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest } from '@/shared/types/api'
import StoryActivity from './StoryActivity'

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

function Harness({ request, onOpenMessages = () => {} }: { request: ApiRequest; onOpenMessages?: () => void }) {
  const [open, setOpen] = useState(false)
  return <StoryActivity request={request} storyId={12} open={open} onOpenChange={setOpen} onOpenMessages={onOpenMessages} />
}
const click = (selector: string) => act(async () => (host.querySelector(selector) as HTMLButtonElement).click())

describe('StoryActivity', () => {
  it('shows the reaction count, then lists who reacted with what and links to messages in the sheet', async () => {
    const request = vi.fn(async () => Response.json({ likers: [{ id: 2, username: 'viewer', displayName: 'Người xem', emoji: '😂' }] }))
    const onOpenMessages = vi.fn()
    await act(async () => root.render(<Harness request={request} onOpenMessages={onOpenMessages} />))
    expect(host.textContent).toContain('1 cảm xúc')
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    await click('button[aria-haspopup="dialog"]')
    const list = host.querySelector('ul[aria-label="Người đã bày tỏ cảm xúc"]')
    expect(list?.textContent).toContain('Người xem')
    expect(list?.querySelector('[role="img"][aria-label="Haha"]')?.textContent).toBe('😂')
    await act(async () => ([...host.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Mở Tin nhắn') as HTMLButtonElement).click())
    expect(onOpenMessages).toHaveBeenCalled()
    await click('button[aria-label="Đóng hoạt động"]')
    expect(host.querySelector('[role="dialog"]')).toBeNull()
  })

  it('marks the count as partial when more pages exist', async () => {
    const request = vi.fn(async () => Response.json({ likers: [{ id: 2, username: 'a', displayName: 'A' }], next: 2 }))
    await act(async () => root.render(<Harness request={request} />))
    expect(host.textContent).toContain('1+ cảm xúc')
  })

  it('reports a failed load instead of showing zero likes', async () => {
    const request = vi.fn(async () => new Response(null, { status: 500 }))
    await act(async () => root.render(<Harness request={request} />))
    expect(host.textContent).toContain('Không tải được')
    expect(host.textContent).not.toContain('Chưa có cảm xúc nào')
  })
})
