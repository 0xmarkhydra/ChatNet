// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useFollowingPosts } from '../src/features/feed/hooks/useFollowingPosts'
import type { Post } from '../src/features/feed/types'

afterEach(() => { document.body.innerHTML = '' })

describe('following posts lifecycle', () => {
  it('shows loading on first visit and refresh without leaking the previous result', async () => {
    const oldAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const pending: Array<(response: Response) => void> = []
    const request = () => new Promise<Response>(resolve => { pending.push(resolve) })
    let current: ReturnType<typeof useFollowingPosts> | null = null
    function Probe({ sessionId }: { sessionId: string }) {
      const state = useFollowingPosts({ sessionId, enabled: true, request })
      useLayoutEffect(() => { current = state })
      return <p data-loading={state.loading}>{state.posts.map(post => post.id).join(',')}</p>
    }
    const deliver = async (index: number, id: number) => {
      await act(async () => {
        pending[index](new Response(JSON.stringify([{ id }]), { status: 200 }))
        await Promise.resolve()
        await Promise.resolve()
      })
    }
    try {
      await act(async () => root.render(<Probe sessionId="A" />))
      expect(container.textContent).toBe('')
      expect(current?.loading).toBe(true)
      expect(pending).toHaveLength(1)
      await deliver(0, 1)
      expect(container.textContent).toBe('1')
      expect(current?.loading).toBe(false)
      await act(async () => current?.refresh())
      expect(container.textContent).toBe('')
      expect(current?.loading).toBe(true)
      expect(pending).toHaveLength(2)
      await deliver(1, 2)
      expect(current?.posts.map((post: Post) => post.id)).toEqual([2])
      await act(async () => root.render(<Probe sessionId="B" />))
      expect(container.textContent).toBe('')
      expect(current?.loading).toBe(true)
      await deliver(2, 3)
      expect(current?.posts.map((post: Post) => post.id)).toEqual([3])
    } finally {
      await act(async () => root.unmount())
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = oldAct
    }
  })
})
