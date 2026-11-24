// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedText } from './FeedDiscussion'

const api = 'https://translate.example.invalid'
let observeVisible: () => void
const json = (translatedText: string) => new Response(JSON.stringify({ translatedText }))
let serial = 0

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) {
      observeVisible = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    }
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function mount(overrides: Partial<React.ComponentProps<typeof FeedText>> = {}) {
  const props = { api, token: 'test-token-' + ++serial, target: 'vi', text: 'Original text', ...overrides }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let closed = false
  const render = (next = {}) => act(async () => root.render(<FeedText {...props} {...next} />))
  return {
    host, props, render,
    async visible() { await act(async () => observeVisible()) },
    async click(label: string) {
      const button = [...host.querySelectorAll('button')].find(item => item.textContent === label)
      if (!button) throw new Error('Missing button: ' + label)
      await act(async () => button.click())
    },
    async close() {
      if (closed) return
      closed = true
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

describe('FeedText translation characterization', () => {
  it('waits until visible, posts the authenticated contract and toggles original text', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json('Bản dịch'))
    vi.stubGlobal('fetch', fetcher)
    const page = mount()
    try {
      await page.render()
      expect(fetcher).not.toHaveBeenCalled()
      expect(page.host.querySelector('p')?.textContent).toBe(page.props.text)
      await page.visible()
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(fetcher.mock.calls[0][0]).toBe(api + '/api/translate')
      const request = fetcher.mock.calls[0][1] as RequestInit
      expect(request.method).toBe('POST')
      expect(request.headers).toEqual({ Authorization: 'Bearer ' + page.props.token, 'Content-Type': 'application/json' })
      expect(JSON.parse(request.body as string)).toEqual({ text: page.props.text, target: 'vi' })
      expect(request.signal).toBeInstanceOf(AbortSignal)
      expect(page.host.querySelector('p')?.textContent).toBe('Bản dịch')
      await page.click('Xem bản gốc')
      expect(page.host.querySelector('p')?.textContent).toBe(page.props.text)
      await page.click('Xem bản dịch')
      expect(page.host.querySelector('p')?.textContent).toBe('Bản dịch')
    } finally { await page.close() }
  })

  it('retries after 2s and 4s only, then retains original and displays the error', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockImplementation(async () => new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    const page = mount()
    try {
      await page.render()
      await page.visible()
      expect(fetcher).toHaveBeenCalledTimes(1)
      await act(async () => vi.advanceTimersByTimeAsync(1999))
      expect(fetcher).toHaveBeenCalledTimes(1)
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(fetcher).toHaveBeenCalledTimes(2)
      await act(async () => vi.advanceTimersByTimeAsync(3999))
      expect(fetcher).toHaveBeenCalledTimes(2)
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(page.host.querySelector('p')?.textContent).toBe(page.props.text)
      expect(page.host.textContent).toContain('Chưa dịch được. Đang hiển thị bản gốc.')
      await act(async () => vi.advanceTimersByTimeAsync(10000))
      expect(fetcher).toHaveBeenCalledTimes(3)
    } finally { await page.close() }
  })

  it('retries network failures after 2s and 4s, then retains original and displays the error', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetcher)
    const page = mount()
    try {
      await page.render()
      await page.visible()
      expect(fetcher).toHaveBeenCalledTimes(1)
      await act(async () => vi.advanceTimersByTimeAsync(1999))
      expect(fetcher).toHaveBeenCalledTimes(1)
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(fetcher).toHaveBeenCalledTimes(2)
      await act(async () => vi.advanceTimersByTimeAsync(3999))
      expect(fetcher).toHaveBeenCalledTimes(2)
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(page.host.querySelector('p')?.textContent).toBe(page.props.text)
      expect(page.host.textContent).toContain('Chưa dịch được. Đang hiển thị bản gốc.')
    } finally { await page.close() }
  })

  it('retries empty translatedText after 2s and 4s, then retains original and displays the error', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockImplementation(async () => json('  '))
    vi.stubGlobal('fetch', fetcher)
    const page = mount()
    try {
      await page.render()
      await page.visible()
      expect(fetcher).toHaveBeenCalledTimes(1)
      await act(async () => vi.advanceTimersByTimeAsync(1999))
      expect(fetcher).toHaveBeenCalledTimes(1)
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(fetcher).toHaveBeenCalledTimes(2)
      await act(async () => vi.advanceTimersByTimeAsync(3999))
      expect(fetcher).toHaveBeenCalledTimes(2)
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(page.host.querySelector('p')?.textContent).toBe(page.props.text)
      expect(page.host.textContent).toContain('Chưa dịch được. Đang hiển thị bản gốc.')
    } finally { await page.close() }
  })

  it('isolates cached translations by token, target, API and source text', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json('Bản dịch'))
    vi.stubGlobal('fetch', fetcher)
    const first = mount()
    try {
      await first.render()
      await first.visible()
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally { await first.close() }
    const cached = mount(first.props)
    try {
      await cached.render()
      await cached.visible()
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(cached.host.querySelector('p')?.textContent).toBe('Bản dịch')
      for (const [i, next] of [
        { token: first.props.token + '-other' },
        { target: 'en' },
        { api: api + '/other' },
        { text: 'Changed source' },
      ].entries()) {
        await cached.render(next)
        expect(fetcher).toHaveBeenCalledTimes(i + 2)
      }
    } finally { await cached.close() }
  })

  it('aborts stale requests on key changes and unmount; cancels queued retries', async () => {
    vi.useFakeTimers()
    let resolveOld!: (response: Response) => void
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve }))
      .mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetcher)
    const page = mount()
    try {
      await page.render()
      await page.visible()
      const oldSignal = (fetcher.mock.calls[0][1] as RequestInit).signal
      await page.render({ text: 'New source' })
      expect(oldSignal?.aborted).toBe(true)
      await act(async () => resolveOld(json('Old translation')))
      expect(page.host.querySelector('p')?.textContent).toBe('New source')
      expect(fetcher).toHaveBeenCalledTimes(2)
      const newSignal = (fetcher.mock.calls[1][1] as RequestInit).signal
      await page.close()
      expect(newSignal?.aborted).toBe(true)
      await act(async () => vi.advanceTimersByTimeAsync(10000))
      expect(fetcher).toHaveBeenCalledTimes(2)
    } finally { await page.close() }
  })

  it('does not translate blank text or an empty target and keeps expand behavior', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json('Bản dịch'))
    vi.stubGlobal('fetch', fetcher)
    const longText = 'a'.repeat(150)
    const onExpand = vi.fn()
    const page = mount({ text: ' ', target: 'vi', maxLines: 2 })
    try {
      await page.render()
      await page.visible()
      expect(fetcher).not.toHaveBeenCalled()
      await page.render({ text: longText, target: '' })
      expect(fetcher).not.toHaveBeenCalled()
      expect(page.host.querySelector('p')?.className).toBe('feed-text-clamped')
      await page.click('Xem thêm')
      expect(page.host.querySelector('p')?.className).toBe('')
      await page.render({ text: longText + '!', target: '', onExpand })
      await page.click('Xem thêm')
      expect(onExpand).toHaveBeenCalledOnce()
      expect(page.host.querySelector('p')?.className).toBe('feed-text-clamped')
    } finally { await page.close() }
  })

  it('retains the 200-entry FIFO cache bound and evicts the oldest key', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json('Bản dịch'))
    vi.stubGlobal('fetch', fetcher)
    const page = mount({ text: 'fifo-0' })
    try {
      await page.render()
      await page.visible()
      for (let i = 1; i <= 200; i++) await page.render({ text: 'fifo-' + i })
      expect(fetcher).toHaveBeenCalledTimes(201)
      await page.render({ text: 'fifo-200' })
      expect(fetcher).toHaveBeenCalledTimes(201)
      await page.render({ text: 'fifo-0' })
      expect(fetcher).toHaveBeenCalledTimes(202)
    } finally { await page.close() }
  })

  it('does not refresh FIFO order when a cached translation is read', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json('Bản dịch'))
    vi.stubGlobal('fetch', fetcher)
    const page = mount({ api: api + '/fifo-no-refresh', text: 'fifo-no-refresh-0' })
    try {
      await page.render()
      await page.visible()
      for (let i = 1; i < 200; i++) await page.render({ text: 'fifo-no-refresh-' + i })
      expect(fetcher).toHaveBeenCalledTimes(200)
      await page.render({ text: 'fifo-no-refresh-0' })
      expect(fetcher).toHaveBeenCalledTimes(200)
      await page.render({ text: 'fifo-no-refresh-200' })
      expect(fetcher).toHaveBeenCalledTimes(201)
      await page.render({ text: 'fifo-no-refresh-0' })
      expect(fetcher).toHaveBeenCalledTimes(202)
    } finally { await page.close() }
  })
})
