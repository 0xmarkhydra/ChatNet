// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../types'
import PostCommentsPage from './PostCommentsPage'

const original: Post = {
  id: 12, author: 'linh', content: 'Bài gốc', likes: 0, liked: false, comments: [],
  createdAt: '', visibility: 'public',
}
const quickRepost: Post = {
  ...original, id: 60, content: '', repostKind: 'quick', originalPost: original,
}

describe('quick repost detail actions', () => {
  let host: HTMLDivElement
  let root: Root
  const onOpenOriginal = vi.fn<(id: number) => void>()
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    onOpenOriginal.mockClear()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.open = false } })
    act(() => root.render(<PostCommentsPage post={quickRepost} onClose={vi.fn()} username="viewer" token="test"
      targetLanguage="en" likeBusy={false} request={vi.fn()} onLike={vi.fn(async () => undefined)}
      onReactionUsers={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} onFeedback={vi.fn()}
      onAuthorOpen={vi.fn()} sortOrder="newest" onSortChange={vi.fn()} onOpenOriginal={onOpenOriginal}>
      {null}
    </PostCommentsPage>))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
    if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  })

  it('offers comments on the original from quick repost details', async () => {
    const actionBar = host.querySelector('.post-comments-post-actions')
    expect(actionBar?.querySelectorAll('button')).toHaveLength(2)
    const commentButton = actionBar?.querySelector<HTMLButtonElement>('button')
    await act(async () => commentButton?.click())
    expect(onOpenOriginal).toHaveBeenCalledWith(original.id)
  })
})
