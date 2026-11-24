// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeedPostActions from './FeedPostActions'

const post = { id: 42, author: 'alice', content: 'Bài viết', visibility: 'friends' } as const

describe('feed post sharing', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const writeText = vi.fn(async (_url: string) => {})
  const share = vi.fn(async (_data: ShareData) => {})
  const onFeedback = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.clearAllMocks()
    vi.stubGlobal('navigator', { clipboard: { writeText }, share })
    window.history.replaceState(null, '', '/feed/posts/88?tab=feed&post=88&invite=other#comments')
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  async function click(query: string, byText = false) {
    const button = Array.from(document.querySelectorAll('button')).find(item =>
      (byText ? item.textContent?.trim() : item.getAttribute('aria-label')) === query,
    )
    if (!button) throw new Error(`Missing button ${query}`)
    await act(async () => { button.click() })
  }

  function renderPostMenu() {
    act(() => root.render(<FeedPostActions post={post} mine={false} request={vi.fn()}
      onUpdated={vi.fn()} onDeleted={vi.fn()} onFeedback={onFeedback} />))
  }

  it('shares the exact selected post without copying unrelated query or fragment state', async () => {
    renderPostMenu()
    await click('Tùy chọn bài viết')
    await click('Chia sẻ bài viết', true)
    expect(share).toHaveBeenCalledWith({
      title: 'Bài viết ChatNet',
      url: `${window.location.origin}/feed/posts/42?ref=share`,
    })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the same permalink from the post menu even if native share is available', async () => {
    act(() => root.render(
      <FeedPostActions post={post} mine={false} request={vi.fn()} onUpdated={vi.fn()}
        onDeleted={vi.fn()} onFeedback={onFeedback} />,
    ))
    await click('Tùy chọn bài viết')
    await click('Sao chép liên kết', true)
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/feed/posts/42?ref=share`)
    expect(share).not.toHaveBeenCalled()
    expect(onFeedback).toHaveBeenCalledWith('Đã sao chép liên kết bài viết.', 'success')
  })

  it('copies the permalink from the external share action when native share is unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    renderPostMenu()
    await click('Tùy chọn bài viết')
    await click('Chia sẻ bài viết', true)
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/feed/posts/42?ref=share`)
  })

  it('shares a quick repost using its original post permalink', async () => {
    const quickRepost = { ...post, id: 60, repostKind: 'quick' as const, originalPost: { id: 12 } }
    act(() => root.render(<FeedPostActions post={quickRepost} mine={false} request={vi.fn()}
      onUpdated={vi.fn()} onDeleted={vi.fn()} onFeedback={onFeedback} />))
    await act(async () => { document.querySelector<HTMLButtonElement>('.post-more')?.click() })
    await act(async () => { document.querySelectorAll<HTMLButtonElement>('.feed-actions-list button')[1]?.click() })
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      url: `${window.location.origin}/feed/posts/12?ref=share`,
    }))
  })
})
