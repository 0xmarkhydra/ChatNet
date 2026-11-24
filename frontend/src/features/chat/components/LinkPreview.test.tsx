// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import LinkPreview from './LinkPreview'

const post = {
  id: 15, author: 'linh', authorDisplayName: 'Nguyễn Linh', content: 'Nội dung bài viết thử',
  attachments: [{ kind: 'image', url: 'https://media.example/post15.jpg' }],
}

describe('shared post previews in chat', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  function Location() {
    return <output>{useLocation().pathname}</output>
  }

  async function render(url: string, request: (url: string, init?: RequestInit) => Promise<Response>, scope = 'test-session') {
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/chat/1']}>
        <LinkPreview text={'Xem thử: ' + url} cacheScope={scope} request={request} />
        <Location />
      </MemoryRouter>,
    ))
  }

  it.each(['/feed?tab=feed&post=15', '/?tab=feed&post=15', '/feed/posts/15'])(
    'renders the authorized post and opens its canonical route for %s',
    async path => {
      const request = vi.fn(async () => Response.json(post))
      await render('https://chat.codelocal.cloud' + path, request)
      expect(request.mock.calls).toEqual([['/api/posts/15', { cache: 'no-store' }]])
      expect(host.textContent).toContain('Nguyễn Linh')
      expect(host.textContent).toContain(post.content)
      expect(host.querySelector<HTMLImageElement>('.media-attachments img')?.src).toBe(post.attachments[0].url)
      const link = host.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/feed/posts/15')
      act(() => link?.click())
      expect(host.querySelector('output')?.textContent).toBe('/feed/posts/15')
    },
  )

  it('keeps approved share parameters and drops unknown query values', async () => {
    const request = vi.fn(async () => Response.json(post))
    await render('https://chat.codelocal.cloud/feed/posts/15?ref=share&source=chat&token=private', request)
    expect(host.querySelector('a')?.getAttribute('href'))
      .toBe('/feed/posts/15?ref=share&source=chat')
  })

  it('renders caption, location, tags, and feeling as separate post details', async () => {
    const content = [
      '📍 Hà Nội',
      '👥 Cùng với @mai, @an',
      '😊 Đang cảm thấy vui vẻ',
      'Một ngày đẹp trời',
    ].join('\n')
    await render('https://chat.codelocal.cloud/feed/posts/15', async () =>
      Response.json({ ...post, content }))

    const card = host.querySelector('article')
    const details = card?.querySelector('section[aria-label="Thông tin bài viết"]')
    expect(card?.querySelector('.whitespace-pre-wrap')?.textContent).toBe('Một ngày đẹp trời')
    expect(details?.querySelectorAll('p')).toHaveLength(3)
    expect(details?.textContent).toContain('Hà Nội')
    expect(details?.textContent).toContain('@mai, @an')
    expect(details?.textContent).toContain('vui vẻ')
  })

  it('does not render serialized metadata as caption when post has no caption', async () => {
    const content = [
      '📍 Đà Nẵng',
      '👥 Cùng với @mai',
      '😊 Đang cảm thấy vui vẻ',
    ].join('\n')
    await render('https://chat.codelocal.cloud/feed/posts/15', async () =>
      Response.json({ ...post, content }))

    const card = host.querySelector('article')
    const details = card?.querySelector('section[aria-label="Thông tin bài viết"]')
    expect(card?.querySelector('.whitespace-pre-wrap')).toBeNull()
    expect(details?.querySelectorAll('p')).toHaveLength(3)
    expect(details?.textContent).toContain('Đà Nẵng')
    expect(details?.textContent).toContain('@mai')
    expect(details?.textContent).toContain('vui vẻ')
  })

  it('renders metadata-only original repost without raw serialized content', async () => {
    const originalContent = [
      '📍 Huế',
      '👥 Cùng với @linh',
      '😊 Đang cảm thấy vui vẻ',
    ].join('\n')
    await render('https://chat.codelocal.cloud/feed/posts/15', async () =>
      Response.json({
        ...post,
        repostKind: 'quote',
        originalPost: {
          id: 14,
          author: 'linh',
          content: originalContent,
          attachments: [],
        },
      }))

    const original = host.querySelector('section[aria-label="Bài viết gốc"]')
    const details = original?.querySelector('section[aria-label="Thông tin bài viết"]')
    expect(original?.querySelector('p.whitespace-pre-wrap')).toBeNull()
    expect(details?.querySelectorAll('p')).toHaveLength(3)
    expect(details?.textContent).toContain('Huế')
    expect(details?.textContent).toContain('@linh')
  })

  it.each([403, 404])('does not expose any post content or load a generic banner on %s', async status => {
    const request = vi.fn(async () => Response.json(post, { status }))
    await render('https://chat.codelocal.cloud/feed/posts/15', request)
    expect(request).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('bạn không có quyền xem')
    expect(host.textContent).not.toContain(post.content)
    expect(host.querySelector('img')).toBeNull()
  })

  it.each([429, 500])('shows recoverable error and retries safely after HTTP %s', async status => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status,
        ...(status === 429 ? { headers: { 'Retry-After': '0' } } : {}),
      }))
      .mockResolvedValueOnce(Response.json(post))
    await render('https://chat.codelocal.cloud/feed/posts/15', request)

    expect(host.textContent).toMatch(/thử lại/i)
    expect(request).toHaveBeenCalledTimes(1)
    if (status === 429) {
      await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 5)) })
    }
    await act(async () => host.querySelector('button')?.click())
    expect(request).toHaveBeenCalledTimes(2)
    expect(host.textContent).toContain(post.content)
  })

  it('shows session error on 401 and allows retry after re-authentication', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json(post))
    await render('https://chat.codelocal.cloud/feed/posts/15', request)

    expect(host.textContent).toContain('Phiên đăng nhập hết hạn')
    await act(async () => host.querySelector('button')?.click())
    expect(request).toHaveBeenCalledTimes(2)
    expect(host.textContent).toContain(post.content)
  })

  it('waits for Retry-After before retrying a rate-limited request', async () => {
    const request = vi.fn(async () => new Response(null, {
      status: 429,
      headers: { 'Retry-After': '60' },
    }))
    await render('https://chat.codelocal.cloud/feed/posts/15', request)

    expect(host.textContent).toContain('Máy chủ giới hạn yêu cầu')
    expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['malformed', 'not-a-date'],
    ['negative delay', '-1'],
  ])('uses fallback cooldown when Retry-After is %s', async (_case, retryAfter) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    try {
      const headers: HeadersInit = retryAfter === undefined ? {} : { 'Retry-After': retryAfter }
      const request = vi.fn(async () => new Response(null, { status: 429, headers }))
      await render('https://chat.codelocal.cloud/feed/posts/15', request)

      const retryButton = host.querySelector<HTMLButtonElement>('button')
      expect(retryButton?.disabled).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(29_999) })
      expect(retryButton?.disabled).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(retryButton?.disabled).toBe(false)
      expect(request).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers retry after a network failure', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(Response.json(post))
    await render('https://chat.codelocal.cloud/feed/posts/15', request)

    expect(host.textContent).toContain('Không tải được bài viết')
    await act(async () => host.querySelector('button')?.click())
    expect(request).toHaveBeenCalledTimes(2)
    expect(host.textContent).toContain(post.content)
  })

  it('clears a displayed post on a privacy change and checks permission again', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json(post))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    await render('https://chat.codelocal.cloud/feed/posts/15', request)
    expect(host.textContent).toContain(post.content)
    await act(async () => window.dispatchEvent(new Event('chatnet:privacy-updated')))
    expect(request).toHaveBeenCalledTimes(2)
    expect(host.textContent).not.toContain(post.content)
    expect(host.querySelector('img')).toBeNull()
  })

  it('never applies a response from a prior session to the same link', async () => {
    const url = 'https://chat.codelocal.cloud/feed/posts/15'
    let finishOldRequest!: (value: Response) => void
    const first = vi.fn(() => new Promise<Response>(resolve => { finishOldRequest = resolve }))
    await render(url, first, 'old')
    await render(url, async () => new Response(null, { status: 404 }), 'new')
    await act(async () => finishOldRequest(Response.json(post)))
    expect(host.textContent).not.toContain(post.content)
    expect(host.querySelector('img')).toBeNull()
  })

  it('retains metadata preview for an external link with an identical path', async () => {
    const url = 'https://other.example/feed/posts/15'
    const request = vi.fn(async () => Response.json({ title: 'External page', url, domain: 'other.example' }))
    await render(url, request)
    expect(request.mock.calls).toEqual([['/api/link-preview?url=' + encodeURIComponent(url), undefined]])
    expect(host.textContent).toContain('External page')
    expect(host.querySelector('a')?.href).toBe(url)
  })
})
