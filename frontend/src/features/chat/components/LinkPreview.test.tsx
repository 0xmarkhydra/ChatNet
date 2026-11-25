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
      expect(host.querySelector('img')?.src).toBe(post.attachments[0].url)
      const link = host.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/feed/posts/15')
      act(() => link?.click())
      expect(host.querySelector('output')?.textContent).toBe('/feed/posts/15')
    },
  )

  it.each([403, 404])('does not expose any post content or load a generic banner on %s', async status => {
    const request = vi.fn(async () => Response.json(post, { status }))
    await render('https://chat.codelocal.cloud/feed/posts/15', request)
    expect(request).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('bạn không có quyền xem')
    expect(host.textContent).not.toContain(post.content)
    expect(host.querySelector('img')).toBeNull()
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
