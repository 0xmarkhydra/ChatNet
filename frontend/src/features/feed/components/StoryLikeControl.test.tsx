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
import StoryLikeControl from './StoryLikeControl'

describe('private Story likes', () => {
  it('loads its own state and uses only idempotent like and unlike methods', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method ? new Response(null, { status: 204 }) : Response.json({ liked: true }))
    await render(<StoryLikeControl request={request} storyId={12} owner={false} onInspect={vi.fn()} />)
    const toggle = button('Thả tim Story')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    await click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(request).toHaveBeenCalledWith('/api/stories/12/like', { method: 'DELETE' })
    await click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(request).toHaveBeenCalledWith('/api/stories/12/like', { method: 'PUT' })
    expect(document.querySelector('ul[aria-label="Người đã thả tim"]')).toBeNull()
  })

  it('gets a list only when the author opens it', async () => {
    const request = vi.fn(async () => Response.json({ likers: [{ id: 2, username: 'viewer', displayName: 'Người xem' }] }))
    await render(<StoryLikeControl request={request} storyId={12} owner onInspect={vi.fn()} />)
    expect(request).not.toHaveBeenCalled()
    await click(button('Người đã thả tim'))
    expect(document.body.textContent).toContain('Người xem')
    expect(findButton('Thả tim Story')).toBeUndefined()
  })
})