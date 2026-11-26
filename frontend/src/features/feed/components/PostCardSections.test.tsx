// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Post } from '../types'
import { PostCardToolbar } from './PostCardSections'

it('keeps the composer mounted and opens the full post detail from the comment action', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const post = { id: 1, author: 'alice', visibility: 'private', liked: false } as Post
  const noop = vi.fn()
  const openPost = vi.fn()

  try {
    act(() => root.render(
      <PostCardToolbar
        post={post}
        busy={false}
        like={vi.fn(async () => {})}
        apiFetch={vi.fn() as unknown as (path: string, init?: RequestInit) => Promise<Response>}
        syncFeedPost={noop}
        removeFeedPost={noop}
        setNotice={noop}
        discussion={<textarea aria-label="Viết bình luận" />}
        openPost={openPost}
      />,
    ))

    const composer = container.querySelector('textarea')
    const commentButton = container.querySelector<HTMLButtonElement>('button[aria-label="Mở bài viết để bình luận"]')
    expect(composer).not.toBeNull()
    expect(container.querySelector('.feed-inline-comments')).not.toBeNull()
    expect(commentButton).not.toBeNull()
    expect(commentButton?.getAttribute('aria-controls')).toBeNull()

    act(() => commentButton?.click())
    expect(openPost).toHaveBeenCalledTimes(1)
    expect(document.activeElement).not.toBe(composer)
  } finally {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
