// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { collapseQuickReposts } from '../utils/feedRequestState'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeedRepostAction from './FeedRepostAction'
import type { Post } from '../types'

const source: Post = { id: 12, author: 'linh', content: 'Bài gốc', likes: 0, liked: false, comments: [], createdAt: '', visibility: 'public' }
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

const actEnv = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const priorActEnv = actEnv.IS_REACT_ACT_ENVIRONMENT
let host: HTMLDivElement
let root: Root
let clipboardDescriptor: PropertyDescriptor | undefined
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  actEnv.IS_REACT_ACT_ENVIRONMENT = true
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.open = false } })
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  actEnv.IS_REACT_ACT_ENVIRONMENT = priorActEnv
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

function button(label: string) {
  return Array.from(host.querySelectorAll('button')).find(node =>
    (node.getAttribute('aria-label') || node.textContent?.trim()) === label)
}

async function click(label: string) {
  const node = button(label)
  if (!node) throw new Error('Missing button: ' + label)
  await act(async () => node.click())
}

async function setup(post: Post, response: Response, onShareToChat?: (url: string) => void) {
  const request = vi.fn().mockResolvedValue(response)
  const onUpdated = vi.fn()
  const onRemoved = vi.fn()
  await act(async () => root.render(<FeedRepostAction post={post} request={request} onUpdated={onUpdated} onRemoved={onRemoved} onFeedback={vi.fn()} onShareToChat={onShareToChat} />))
  return { request, onUpdated, onRemoved }
}
describe('Repost controls', () => {
  it('offers a quick repost and updates the original with the server response', async () => {
    const result = { ...source, myRepostId: 60, repostCount: 1 }
    const { request, onUpdated } = await setup(source, new Response(JSON.stringify(result), { status: 201 }))
    await click('Chia sẻ bài viết')
    await click('Đăng lại ngay')
    expect(onUpdated).toHaveBeenCalledWith(result)
    expect(request).toHaveBeenCalledWith('/api/posts/12/repost', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ kind: 'quick', content: '' }),
    }))
  })

  it('keeps a failed quote draft and shows an error if the source disappears', async () => {
    const { request, onUpdated } = await setup(source, new Response(null, { status: 404 }))
    await click('Chia sẻ bài viết')
    await click('Đăng lại kèm lời')
    const textarea = host.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, '  Ý kiến  ')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('Đăng bài trích dẫn')
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Bài viết gốc không còn khả dụng.')
    expect(textarea.value).toBe('  Ý kiến  ')
    expect(request).toHaveBeenCalledWith('/api/posts/12/repost', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ kind: 'quote', content: 'Ý kiến' }),
    }))
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('removes the quick repost by source id', async () => {
    const { request, onRemoved } = await setup({ ...source, myRepostId: 60, repostCount: 1 }, new Response(null, { status: 204 }))
    await click('Chia sẻ bài viết')
    await click('Bỏ đăng lại')
    expect(onRemoved).toHaveBeenCalledWith(60)
    expect(request).toHaveBeenCalledWith('/api/posts/12/repost', { method: 'DELETE' })
  })

  it('offers sending only the original permalink for quick reposts', async () => {
    const onShare = vi.fn()
    await setup({ ...source, id: 60, repostKind: 'quick', originalPost: source }, new Response(), onShare)
    await click('Chia sẻ bài viết')
    await click('Gửi qua chat')
    expect(onShare).toHaveBeenCalledOnce()
    const sharedUrl = new URL(onShare.mock.calls[0][0])
    expect(sharedUrl.pathname).toBe('/feed/posts/12')
    expect(sharedUrl.search).toBe('?ref=share&source=chat')
  })

  it('copies a share permalink without chat source', async () => {
    const writeText = vi.fn(async (_value: string) => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await setup(source, new Response())
    await click('Chia sẻ bài viết')
    await click('Sao chép liên kết')
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    const copiedUrl = new URL(writeText.mock.calls[0][0])
    expect(copiedUrl.pathname).toBe('/feed/posts/12')
    expect(copiedUrl.search).toBe('?ref=share')
  })

  it('does not offer reposting or sending for private posts', async () => {
    await setup({ ...source, visibility: 'private' }, new Response(), vi.fn())
    await click('Chia sẻ bài viết')
    expect(button('Đăng lại ngay')).toBeUndefined()
    expect(button('Đăng lại kèm lời')).toBeUndefined()
    expect(button('Gửi qua chat')).toBeUndefined()
  })
})

it('deduplicates the original and repeated quick reposts but keeps quotes', () => {
  const quick = { ...source, id: 30, originalPost: source, repostKind: 'quick' } as const
  const quote = { ...source, id: 31, originalPost: source, repostKind: 'quote' } as const
  expect(collapseQuickReposts([quote, quick, { ...quick, id: 22 }, source])).toEqual([quote, quick])
})
