// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import StoryHighlights from './StoryHighlights'

it('shows an expired highlight on the profile and lets only its author remove it', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const item = {
    id: 12, title: 'Chuyến đi', author: 'owner', text: 'Tin đã hết hạn',
    background: 'indigo', createdAt: '2026-11-12T00:00:00Z', expiresAt: '2026-11-13T00:00:00Z',
  }
  const next = { ...item, id: 13, title: 'Kỷ niệm', text: 'Tin nổi bật tiếp theo' }
  let removed = false
  const request = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      removed = true
      return new Response(null, { status: 204 })
    }
    return Response.json(removed ? [next] : [item, next])
  })
  async function click(text: string) {
    const target = [...document.querySelectorAll('button')].find(button => button.textContent?.includes(text))
    if (!target) throw new Error('Button missing: ' + text)
    await act(async () => target.click())
  }
  try {
    await act(async () => root.render(<StoryHighlights key="visitor" username="owner" request={request} />))
    const tile = host.querySelector<HTMLButtonElement>('ul[role="list"] button[aria-label="Chuyến đi"]')
    expect(tile?.textContent).toContain('Tin đã hết hạn')
    await act(async () => tile?.click())
    const viewer = document.querySelector('[role="dialog"][data-slot="story-viewer"]')
    expect(viewer?.querySelector('[data-slot="story-media"]')?.textContent).toContain('Tin đã hết hạn')
    expect(viewer?.textContent).not.toContain('Khả dụng trong 24 giờ')
    expect(document.querySelector('button[aria-label^="Quản lý Tin nổi bật"]')).toBeNull()
    expect(request).toHaveBeenCalledTimes(1)
    const forward = viewer?.querySelector<HTMLButtonElement>('button[aria-label="Story tiếp theo"]')
    expect(forward).not.toBeNull()
    await act(async () => forward?.click())
    expect(viewer?.querySelector('[data-slot="story-media"]')?.textContent).toContain(next.text)
    expect(viewer?.querySelector('[aria-label="Tin 2 trên 2"]')).not.toBeNull()
    await click('Đóng')
    expect(document.querySelector('[data-slot="story-viewer"]')).toBeNull()
    await act(async () => root.render(<StoryHighlights key="owner" username="owner" request={request} owner mobileProfile />))
    const open = host.querySelector<HTMLButtonElement>('button[aria-label="Chuyến đi"]')
    expect(open?.className).toContain('h-46')
    expect(open?.className).toContain('w-28!')
    expect(open?.className).toContain('rounded-ui-md!')
    await act(async () => open?.click())
    expect(document.querySelector('[data-slot="story-viewer"]')?.textContent).not.toContain('Đổi tên')
    await click('Đóng')
    const manage = host.querySelector<HTMLButtonElement>('button[aria-label="Quản lý Tin nổi bật: Chuyến đi"]')
    expect(manage).not.toBeNull()
    await act(async () => manage?.click())
    expect(document.querySelector('[data-slot="story-viewer"]')).toBeNull()
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Đổi tên')
    await click('Gỡ khỏi Tin nổi bật')
    await click('Xác nhận gỡ')
    expect(request).toHaveBeenCalledWith('/api/stories/12/highlight', { method: 'DELETE' })
    expect(document.body.textContent).not.toContain('Chuyến đi')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})