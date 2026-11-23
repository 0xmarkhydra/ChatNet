// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSearchResults } from './useSearchResults'

afterEach(() => vi.useRealTimers())

describe('global search pagination', () => {
  it('sends filters and cursor, then removes duplicate items', async () => {
    vi.useFakeTimers()
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const paths: string[] = []
    const request = async (path: string) => {
      paths.push(path)
      const cursor = new URL('https://example.test' + path).searchParams.get('cursor')
      const page = cursor ? { items: [{ id: 1 }, { id: 2 }, { id: 2 }], nextCursor: null }
        : { items: [{ id: 1 }], nextCursor: 'next-page' }
      return new Response(JSON.stringify(page), { status: 200 })
    }
    const latest: { current: ReturnType<typeof useSearchResults<{ id: number }>> | null } = { current: null }
    function Probe() {
      const result = useSearchResults<{ id: number }>({
        endpoint: '/api/posts', query: '  cá heo  ', sort: 'newest', since: '2026-10-23T00:00:00.000Z',
        enabled: true, sessionId: 'session-1', request,
      })
      useLayoutEffect(() => { latest.current = result })
      return <div>{result.items.map(item => item.id).join(',')}</div>
    }

    try {
      await act(async () => root.render(<Probe />))
      await act(async () => { await vi.advanceTimersByTimeAsync(350) })
      expect(latest.current?.items.map(item => item.id)).toEqual([1])
      const initial = new URL('https://example.test' + paths[0])
      expect(initial.searchParams.get('q')).toBe('cá heo')
      expect(initial.searchParams.get('sort')).toBe('newest')
      expect(initial.searchParams.get('since')).toBe('2026-10-23T00:00:00.000Z')
      expect(initial.searchParams.get('limit')).toBe('10')

      await act(async () => { await latest.current?.loadMore() })
      expect(new URL('https://example.test' + paths[1]).searchParams.get('cursor')).toBe('next-page')
      expect(latest.current?.items.map(item => item.id)).toEqual([1, 2])
      expect(latest.current?.hasMore).toBe(false)
      expect(host.textContent).toBe('1,2')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })

  it('aborts old search when query changes', async () => {
    vi.useFakeTimers()
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let oldSignal: AbortSignal | undefined
    const request = (path: string, init?: RequestInit) => {
      if (new URL('https://example.test' + path).searchParams.get('q') === 'old') {
        oldSignal = init?.signal as AbortSignal
        return new Promise<Response>(() => {})
      }
      return Promise.resolve(new Response(JSON.stringify({ items: [{ id: 2 }], nextCursor: null }), { status: 200 }))
    }
    function Probe({ query }: { query: string }) {
      const result = useSearchResults<{ id: number }>({ endpoint: '/api/users/search', query, sort: 'relevance', enabled: true, sessionId: 'session-1', request })
      return <div>{result.items.map(item => item.id).join(',')}</div>
    }

    try {
      await act(async () => root.render(<Probe query="old" />))
      await act(async () => { await vi.advanceTimersByTimeAsync(350) })
      await act(async () => root.render(<Probe query="new" />))
      expect(oldSignal?.aborted).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(350) })
      expect(host.textContent).toBe('2')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
