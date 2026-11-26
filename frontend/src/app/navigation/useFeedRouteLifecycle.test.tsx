// @vitest-environment jsdom
import { act, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { useFeedRouteLifecycle } from './useFeedRouteLifecycle'

describe('Feed route and scroll lifecycle', () => {
  it('uses URL for Back/Forward post selection and resets scroll only when search changes', async () => {
    const previous = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    function Probe({ query, pathname, search, tab = 'feed' }: {
      query: string; pathname: string; search: string; tab?: 'feed' | 'chat'
    }) {
      const ref = useRef<HTMLDivElement>(null)
      const [scrolled, setScrolled] = useState(true)
      const [post, setPost] = useState<number | null>(null)
      useFeedRouteLifecycle({
        tab, searchKey: query.trim().toLocaleLowerCase('vi-VN'),
        feedViewRef: ref, setSearchHasScrolled: setScrolled,
        pathname, search, getPostIdFromPath: path => path.startsWith('/feed/post/')
          ? Number(path.slice('/feed/post/'.length)) : null,
        setActivePostId: setPost,
      })
      return <><div ref={ref} data-testid="feed-scroll" />
        <span>{post ?? 'none'}|{scrolled ? 'scrolled' : 'top'}</span></>
    }
    const draw = async (query: string, pathname: string, search: string, tab?: 'feed' | 'chat') => {
      await act(async () => root.render(<Probe query={query} pathname={pathname} search={search} tab={tab} />))
    }
    try {
      await draw('', '/feed', '?post=12')
      expect(host.textContent).toContain('12|top')
      const scroll = host.querySelector<HTMLDivElement>('[data-testid="feed-scroll"]')!
      scroll.scrollTop = 65
      await draw('', '/feed/post/24', '')
      expect(host.textContent).toContain('24|top')
      expect(scroll.scrollTop).toBe(65)
      await draw('another keyword', '/feed', '')
      expect(host.textContent).toContain('none|top')
      expect(scroll.scrollTop).toBe(0)
      await draw('another keyword', '/chat', '')
      expect(host.textContent).toContain('none|top')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previous
    }
  })
})
