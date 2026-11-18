// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { FeedDiscussion } from './FeedDiscussion'
import FeedPostActions from './FeedPostActions'

afterEach(() => vi.unstubAllGlobals())

it('loads confirmed comment like and unlike state on reopen and reports a failed change', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const noop = async () => {}
  let liked = false
  const change = vi.fn(async (_id: number, next: boolean) => {
    liked = next
    renderDiscussion()
  })
  function renderDiscussion() {
    root.render(<FeedDiscussion
      api="" token="" target="" currentUser="anh" variant="post-page"
      comments={[{ id: 1, author: 'linh', content: 'Bình luận thử', createdAt: '2026-11-17T08:00:00Z', liked }]}
      editor={{ drafts: {}, replyTo: null }}
      updateEditor={vi.fn()}
      submit={noop} onEdit={noop} onDelete={noop} onReport={noop} onLike={change}
      onAuthorOpen={vi.fn()}
    />)
  }
  function findLike() {
    const button = host.querySelector<HTMLButtonElement>('.feed-comment-actions button[aria-pressed]')
    if (!button) throw new Error('Missing comment like')
    return button
  }
  function reopen() {
    act(() => root.render(null))
    act(renderDiscussion)
  }

  try {
    act(renderDiscussion)
    expect(findLike().getAttribute('aria-pressed')).toBe('false')
    await act(async () => { findLike().click() })
    expect(change).toHaveBeenLastCalledWith(1, true)
    reopen()
    expect(findLike().getAttribute('aria-pressed')).toBe('true')
    change.mockRejectedValueOnce(new Error('Không lưu được lượt thích'))
    await act(async () => { findLike().click() })
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không lưu được')
    expect(findLike().getAttribute('aria-pressed')).toBe('true')
    await act(async () => { findLike().click() })
    expect(change).toHaveBeenLastCalledWith(1, false)
    reopen()
    expect(findLike().getAttribute('aria-pressed')).toBe('false')
  } finally {
    act(() => root.unmount())
    host.remove()
  }
})

it('contains keyboard focus in the post-options modal and restores it on Escape', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const post = { id: 1, author: 'linh', content: 'Bài viết' }
  try {
    act(() => root.render(<FeedPostActions post={post} mine={false}
      request={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} onFeedback={vi.fn()} />))
    const trigger = host.querySelector('button')!
    act(() => { trigger.focus(); trigger.click() })
    const menu = document.body.querySelector('[role=dialog][aria-modal=true]')
    expect(menu).not.toBeNull()
    const controls = menu!.querySelectorAll<HTMLButtonElement>('button')
    expect(document.activeElement).toBe(controls[0])
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(controls[controls.length - 1])
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(controls[0])
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.body.querySelector('[role=dialog]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  } finally {
    act(() => root.unmount())
    host.remove()
  }
})