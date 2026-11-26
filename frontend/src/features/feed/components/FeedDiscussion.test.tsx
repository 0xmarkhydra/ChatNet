// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { FeedDiscussion } from './FeedDiscussion'

afterEach(() => vi.unstubAllGlobals())

it('opens profiles by username for a comment and its reply, without linking an unavailable author', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  })
  const container = document.createElement('div')
  const root = createRoot(container)
  const onAuthorOpen = vi.fn()
  const noop = async () => {}
  const createdAt = '2026-11-17T08:00:00Z'
  const click = (name: string) => {
    const button = [...container.querySelectorAll('button')].find(item => item.textContent === name)
    if (!button) throw new Error(`Missing button: ${name}`)
    act(() => button.click())
  }

  try {
    act(() => root.render(
      <FeedDiscussion
        api="" token="" target="" currentUser="me" variant="post-page"
        comments={[
          { id: 1, author: 'alice', authorDisplayName: 'Alice Nguyen', content: 'Bình luận', createdAt },
          { id: 2, parentId: 1, author: 'bob', authorDisplayName: 'Bob Le', content: 'Phản hồi', createdAt },
          { id: 3, author: '', content: 'Bình luận cũ', createdAt },
        ]}
        editor={{ drafts: {}, replyTo: null }}
        updateEditor={vi.fn()}
        submit={noop} onEdit={noop} onDelete={noop} onReport={noop}
        onAuthorOpen={onAuthorOpen}
      />,
    ))

    click('Alice Nguyen')
    click('Xem 1 phản hồi')
    click('Bob Le')
    expect(onAuthorOpen.mock.calls).toEqual([['alice'], ['bob']])
    expect(container.textContent).toContain('Người dùng')
    expect([...container.querySelectorAll('button')].some(item => item.textContent === 'Người dùng')).toBe(false)
  } finally {
    act(() => root.unmount())
  }
})

it('keeps a direct comment composer visible without rendering the comment thread', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  })
  const container = document.createElement('div')
  const root = createRoot(container)
  const noop = async () => {}

  try {
    act(() => root.render(
      <FeedDiscussion
        api="" token="" target="" currentUser="me" variant="post-page" showComments={false}
        comments={[{ id: 1, author: 'alice', content: 'Existing comment', createdAt: '2026-11-17T08:00:00Z' }]}
        editor={{ drafts: {}, replyTo: null }}
        updateEditor={vi.fn()}
        submit={noop} onEdit={noop} onDelete={noop} onReport={noop}
        onAuthorOpen={vi.fn()}
      />,
    ))

    expect(container.querySelector('.feed-comment-threads')).toBeNull()
    expect(container.textContent).not.toContain('Existing comment')
    expect(container.querySelector('textarea[aria-label="Viết bình luận"]')).not.toBeNull()
    expect(container.querySelector('.feed-comment-composer-avatar')).not.toBeNull()
  } finally {
    act(() => root.unmount())
  }
})
