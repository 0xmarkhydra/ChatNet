// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePostSearch } from './usePostSearch'

afterEach(() => vi.useRealTimers())

describe('post search pagination lifecycle', () => {
  it('aborts an old page request when the query changes', async () => {
    vi.useFakeTimers()
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let resolveOldPage: ((response: Response) => void) | undefined
    let oldPageSignal: AbortSignal | undefined
    const request = (path: string, init?: RequestInit): Promise<Response> => {
      if (path.includes('&before=')) {
        oldPageSignal = init?.signal as AbortSignal
        return new Promise(resolve => { resolveOldPage = resolve })
      }
      const q = new URL('https://example.test' + path).searchParams.get('q')
      const ids = q === 'a' ? [10, 9, 8, 7, 6] : [20]
      return Promise.resolve(new Response(JSON.stringify(ids.map(id => ({ id, content: q }))), { status: 200 }))
    }
    const latest: { current: ReturnType<typeof usePostSearch> | null } = { current: null }
    function Probe({ query }: { query: string }) {
      const result = usePostSearch({ query, scope: 'all', enabled: true, sessionId: 'sid', request })
      useLayoutEffect(() => { latest.current = result })
      return <div>{result.posts.map(post => post.id).join(',')}</div>
    }

    try {
      await act(async () => root.render(<Probe query="a" />))
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(latest.current?.hasMore).toBe(true)
      await act(async () => { void latest.current?.loadMore() })
      expect(oldPageSignal?.aborted).toBe(false)
      await act(async () => root.render(<Probe query="b" />))
      expect(oldPageSignal?.aborted).toBe(true)
      resolveOldPage?.(new Response(JSON.stringify([{ id: 5, content: 'a' }]), { status: 200 }))
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(latest.current?.posts.map(post => post.id)).toEqual([20])
      expect(host.textContent).toBe('20')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
