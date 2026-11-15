// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import type { Post } from '../types'
import { usePostRouteLoad } from './usePostRouteLoad'

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const oldAct = globals.IS_REACT_ACT_ENVIRONMENT
beforeEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = oldAct; vi.restoreAllMocks() })

const account = (id: string, token = 'same-token'): Session => ({
  token, sessionId: id,
  user: { id: id === 'A' ? 1 : 2, email: 'test@example.invalid', username: id, displayName: id },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const requests: Array<ReturnType<typeof deferred<Response>>> = []
  const request = vi.fn(() => {
    const pending = deferred<Response>()
    requests.push(pending)
    return pending.promise
  })
  const sessionRef = { current: account('A') as Session | null }
  const onError = vi.fn()
  const setTab = vi.fn()
  let setPosts!: React.Dispatch<React.SetStateAction<Post[]>>
  let setActivePostId!: React.Dispatch<React.SetStateAction<number | null>>
  function Probe({ session, search, tab = 'feed' }: {
    session: Session; search: string; tab?: 'feed' | 'chat'
  }) {
    const [posts, updatePosts] = useState<Post[]>([])
    const [activePostId, updateActivePostId] = useState<number | null>(null)
    setPosts = updatePosts
    setActivePostId = updateActivePostId
    usePostRouteLoad({
      sessionId: session.sessionId, sessionToken: session.token, sessionRef,
      tab, routeSearch: search, request, setTab, setPosts: updatePosts,
      setActivePostId: updateActivePostId, onError,
    })
    return <div>{posts.map(post => post.id).join(',')}|{activePostId ?? ''}</div>
  }

  return {
    host, requests, request, onError, setTab,
    async render(session: Session, search = '?post=11', tab: 'feed' | 'chat' = 'feed') {
      sessionRef.current = session
      await act(async () => root.render(<Probe session={session} search={search} tab={tab} />))
    },
    async resetPosts() {
      await act(async () => { setPosts([]); setActivePostId(null) })
    },
    async close() {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

describe('deep-linked feed posts and account visits', () => {
  it('rejects old response after switching A → B → A even with the same token and route', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      expect(app.requests).toHaveLength(1)
      await app.render(account('B'))
      expect(app.requests).toHaveLength(2)
      await app.render(account('A'))
      expect(app.requests).toHaveLength(3)
      await act(async () => {
        app.requests[0].resolve(Response.json({ id: 77 }))
        app.requests[1].resolve(Response.json({ id: 88 }))
        await Promise.resolve()
      })
      expect(app.host.textContent).toBe('|')
      await act(async () => {
        app.requests[2].resolve(Response.json({ id: 11 }))
        await Promise.resolve()
      })
      expect(app.host.textContent).toBe('11|11')
      expect(app.onError).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('ignores stale route response and errors after the post id changes', async () => {
    const app = setup()
    try {
      await app.render(account('A'), '?post=1')
      await app.render(account('A'), '?post=2')
      await act(async () => {
        app.requests[0].reject(new Error('late old post'))
        app.requests[1].resolve(Response.json({ id: 2 }))
        await Promise.resolve()
      })
      expect(app.host.textContent).toBe('2|2')
      expect(app.onError).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('keeps user-visible errors for a current post and stops callbacks after unmount', async () => {
    const app = setup()
    let closed = false
    try {
      await app.render(account('A'), '?post=4')
      await act(async () => {
        app.requests[0].resolve(new Response(null, { status: 404 }))
        await Promise.resolve()
      })
      expect(app.onError).toHaveBeenCalledWith('Bài viết không tồn tại hoặc bạn không có quyền xem.')

      await app.render(account('A'), '?post=5')
      await app.close()
      closed = true
      app.onError.mockClear()
      await act(async () => {
        app.requests[1].reject(new Error('request after unmount'))
        await Promise.resolve()
      })
      expect(app.onError).not.toHaveBeenCalled()
    } finally {
      if (!closed) await app.close()
    }
  })

  it('preserves the tab=feed deep-link activation while on another tab', async () => {
    const app = setup()
    try {
      await app.render(account('A'), '?tab=feed&post=9', 'chat')
      expect(app.setTab).toHaveBeenCalledWith('feed')
      expect(app.request).toHaveBeenCalledWith('/api/posts/9')
    } finally {
      await app.close()
    }
  })
})
