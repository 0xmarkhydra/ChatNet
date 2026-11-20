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
  let removed = false
  const request = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      removed = true
      return new Response(null, { status: 204 })
    }
    return Response.json(removed ? [] : [item])
  })
  async function click(text: string) {
    const target = [...document.querySelectorAll('button')].find(button => button.textContent?.includes(text))
    if (!target) throw new Error('Button missing: ' + text)
    await act(async () => target.click())
  }
  try {
    await act(async () => root.render(<StoryHighlights key="visitor" username="owner" request={request} />))
    await click('Chuyến đi')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Tin đã hết hạn')
    expect(document.body.textContent).not.toContain('Gỡ khỏi Tin nổi bật')
    await act(async () => root.render(<StoryHighlights key="owner" username="owner" request={request} owner />))
    await click('Chuyến đi')
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
