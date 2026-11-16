// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { usePostSearch } from '../src/features/feed/hooks/usePostSearch'
import type { Post } from '../src/features/feed/types'

afterEach(() => { vi.useRealTimers() })

describe('post search scope lifecycle', () => {
  it('hides previous results immediately when query changes and uses the new response', async () => {
    vi.useFakeTimers()
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const urls: string[] = []
    const request = async (path: string) => {
      urls.push(path)
      const name = new URL('https://example.test' + path).searchParams.get('q') ?? ''
      return new Response(JSON.stringify([{ id: name === 'a' ? 1 : 2, content: name }]), { status: 200 })
    }
    let latest: ReturnType<typeof usePostSearch> | null = null
    function Probe({ query }: { query: string }) {
      const search = usePostSearch({ query, scope: 'all', enabled: true, sessionId: 'session-a', request })
      useLayoutEffect(() => { latest = search })
      return <div data-loading={search.loading}>{search.posts.map(p => p.content).join(',')}</div>
    }
    try {
      await act(async () => root.render(<Probe query="a" />))
      expect(host.textContent).toBe('')
      expect(host.firstElementChild?.getAttribute('data-loading')).toBe('true')
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(latest?.posts.map((p: Post) => p.id)).toEqual([1])
      expect(host.textContent).toBe('a')
      await act(async () => root.render(<Probe query="b" />))
      expect(host.textContent).toBe('')
      expect(host.firstElementChild?.getAttribute('data-loading')).toBe('true')
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(latest?.posts.map((p: Post) => p.id)).toEqual([2])
      expect(host.textContent).toBe('b')
      expect(urls).toHaveLength(2)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
