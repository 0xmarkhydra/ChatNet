// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { useFeedInfiniteScroll } from './useFeedInfiniteScroll'

describe('infinite feed intersection cleanup', () => {
  it('ignores queued observer callbacks after disabling the feed', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const callbackList: IntersectionObserverCallback[] = []
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { callbackList.push(callback) }
      observe() {}
      disconnect = disconnect
    })
    const onLoadMore = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    function Probe({ enabled }: { enabled: boolean }) {
      const sentinel = useFeedInfiniteScroll({
        enabled, hasMore: true, loading: false, error: false, onLoadMore,
      })
      return <div ref={sentinel} />
    }

    try {
      await act(async () => root.render(<Probe enabled />))
      expect(callbackList).toHaveLength(1)
      await act(async () => root.render(<Probe enabled={false} />))
      expect(disconnect).toHaveBeenCalledOnce()
      callbackList[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      expect(onLoadMore).not.toHaveBeenCalled()
      await act(async () => root.render(<Probe enabled />))
      callbackList[1]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      expect(onLoadMore).toHaveBeenCalledOnce()
    } finally {
      await act(async () => root.unmount())
      host.remove()
      vi.unstubAllGlobals()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
