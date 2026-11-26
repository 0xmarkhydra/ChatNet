// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StoryReactionBar from './StoryReactionBar'

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
const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement
const click = (label: string) => act(async () => button(label).click())
const pressed = () => [...host.querySelectorAll('button[aria-pressed="true"]')].map(node => node.getAttribute('aria-label'))

describe('StoryReactionBar', () => {
  it('sets, switches and removes a single reaction', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method ? new Response(null, { status: 204 }) : Response.json({ liked: false }))
    await act(async () => root.render(<StoryReactionBar request={request} storyId={12} />))
    expect(pressed()).toEqual([])
    await click('Haha')
    expect(pressed()).toEqual(['Haha'])
    expect(request).toHaveBeenLastCalledWith('/api/stories/12/like', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ emoji: '😂' }) }))
    await click('Wow')
    expect(pressed()).toEqual(['Wow'])
    await click('Wow')
    expect(pressed()).toEqual([])
    expect(request).toHaveBeenLastCalledWith('/api/stories/12/like', { method: 'DELETE' })
  })

  it('shows a heart for a like from a server without reaction types', async () => {
    const request = vi.fn(async () => Response.json({ liked: true }))
    await act(async () => root.render(<StoryReactionBar request={request} storyId={12} />))
    expect(pressed()).toEqual(['Love'])
  })

  it('rereads the saved reaction when a change cannot be confirmed', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method ? new Response(null, { status: 500 }) : Response.json({ liked: true, emoji: '👍' }))
    await act(async () => root.render(<StoryReactionBar request={request} storyId={12} />))
    await click('Sad')
    expect(pressed()).toEqual(['Like'])
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Không thể xác nhận')
  })
})
