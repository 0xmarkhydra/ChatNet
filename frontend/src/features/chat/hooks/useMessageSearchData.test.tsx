// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMessageSearchData } from './useMessageSearchData'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const cleanup: Array<() => void> = []
afterEach(() => {
  while (cleanup.length) cleanup.pop()!()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

function response(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 })
}

function message(id: number, text: string) {
  return { id, text, sender: 'alice', createdAt: '2026-11-20T10:00:00Z', channelId: 0, attachments: [] }
}

function mount(request: (url: string, init?: RequestInit) => Promise<Response>) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let value!: ReturnType<typeof useMessageSearchData>
  function Probe() {
    value = useMessageSearchData({
      conversationId: 1, channelId: 0, request,
      onJump: async () => {}, onClose: () => {},
    })
    return null
  }
  act(() => root.render(<Probe />))
  cleanup.push(() => { act(() => root.unmount()); host.remove() })
  return { get current() { return value } }
}

describe('message search data ownership', () => {
  it('ignores stale search responses after changing the filter', async () => {
    vi.useFakeTimers()
    const stale = deferred<Response>()
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/members')) return response([])
      if (url.includes('/shared?')) return response({ items: [] })
      if (url.includes('search=old')) return stale.promise
      if (url.includes('/messages?')) return response([message(2, 'new')])
      return response([])
    })
    const app = mount(request)
    act(() => app.current.setKeyword('old'))
    await act(async () => { await vi.advanceTimersByTimeAsync(310) })
    act(() => app.current.setKeyword('new'))
    await act(async () => { await vi.advanceTimersByTimeAsync(310) })
    expect(app.current.messageHits.map(item => item.id)).toEqual([2])
    await act(async () => { stale.resolve(response([message(1, 'old')])); await stale.promise })
    expect(app.current.messageHits.map(item => item.id)).toEqual([2])
  })

  it('combines filenames from shared files with text search results', async () => {
    vi.useFakeTimers()
    const file = { ...message(9, ''), attachments: [{ kind: 'file', name: 'report.pdf', sizeBytes: 1024 }] }
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/members')) return response([])
      if (url.includes('/shared?')) return response({ items: [file] })
      return response([])
    })
    const app = mount(request)
    act(() => app.current.setKeyword('report'))
    await act(async () => { await vi.advanceTimersByTimeAsync(310) })
    expect(app.current.files).toHaveLength(1)
    expect(app.current.messageHits.map(item => item.id)).toEqual([9])
    expect(app.current.loading).toBe(false)
    expect(app.current.loadingFiles).toBe(false)
  })
})
