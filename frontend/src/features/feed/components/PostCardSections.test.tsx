// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Post } from '../types'
import { UiLocaleContext } from '@/shared/i18n/locale'
import { PostCardHeader, PostCardEngagement, PostCardToolbar } from './PostCardSections'

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
it('localizes post age, quote status and engagement for every app locale without changing the author', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-27T09:00:00Z'))
  const container = document.createElement('div')
  const root = createRoot(container)
  const noop = vi.fn()
  const post = { id: 1, author: 'alice', createdAt: '2026-11-27T04:00:00Z', visibility: 'public', repostKind: 'quote', content: 'Nội dung gốc', liked: false, likes: 0, comments: [], repostCount: 1 } as Post
  try {
    for (const [locale, age, quoted, likes, shares] of [
      ['vi','5 giờ trước','Đã trích dẫn','0 lượt thích','1 lượt đăng lại'],
      ['en','5 hours ago','Quoted','0 likes','1 repost'],
      ['zh','5小时前','已引用','0 次点赞','1 次转发'],
      ['ja','5 時間前','引用済み','いいね 0 件','再投稿 1 件'],
      ['ko','5시간 전','인용함','좋아요 0개','재게시 1회'],
    ]) {
      act(() => root.render(<UiLocaleContext.Provider value={{locale}}>
        <PostCardHeader post={post} authorLabel="Nguyễn An" name="alice" openPost={noop}
          apiFetch={vi.fn()} syncFeedPost={noop} removeFeedPost={noop} setNotice={noop} />
        <PostCardEngagement post={post} onReactionUsers={noop} />
      </UiLocaleContext.Provider>))
      expect(container.querySelector('.feed-post-open-date')?.textContent).toBe(age)
      expect(container.querySelector('.feed-post-author')?.textContent).toContain(quoted)
      expect(container.querySelector('.feed-post-author strong')?.textContent).toBe('Nguyễn An')
      expect(container.querySelector('.feed-post-likes')?.textContent).toBe(likes)
      expect(container.querySelector('.feed-post-conversation-stats')?.textContent).toContain(shares)
    }
  } finally { act(() => root.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals() }
})
