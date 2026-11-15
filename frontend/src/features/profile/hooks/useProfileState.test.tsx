// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../../feed'
import { useProfileState } from './useProfileState'

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = globals.IS_REACT_ACT_ENVIRONMENT

beforeEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('matchMedia', () => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
})
afterEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = previousAct
  vi.unstubAllGlobals()
})

describe('profile timeline state isolation', () => {
  it('resets posts, paging and error before paint when switching A → B → A', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let latest!: ReturnType<typeof useProfileState>
    function Probe({ sessionId }: { sessionId: string }) {
      latest = useProfileState({ sessionId })
      return <span>{JSON.stringify({
        posts: latest.profilePosts.map(post => post.id),
        busy: latest.profilePostsBusy,
        error: latest.profilePostsError,
        more: latest.profileHasMore,
      })}</span>
    }
    const render = async (sessionId: string) => {
      await act(async () => root.render(<Probe sessionId={sessionId} />))
      return latest
    }
    try {
      await render('A')
      const oldA = latest
      await act(async () => {
        latest.setProfilePosts([{ id: 1 } as Post])
        latest.setProfilePostsBusy(true)
        latest.setProfilePostsError('stale A error')
        latest.setProfileHasMore(true)
      })
      expect(host.textContent).toContain('"posts":[1]')

      await render('B')
      expect(host.textContent).toBe('{"posts":[],"busy":false,"error":"","more":false}')
      await act(async () => latest.setProfilePosts([{ id: 2 } as Post]))
      expect(host.textContent).toContain('"posts":[2]')

      await render('A')
      expect(host.textContent).toBe('{"posts":[],"busy":false,"error":"","more":false}')
      await act(async () => {
        oldA.setProfilePosts([{ id: 99 } as Post])
        oldA.setProfilePostsError('late A error')
        oldA.setProfilePostsBusy(true)
        oldA.setProfileHasMore(true)
      })
      expect(host.textContent).toBe('{"posts":[],"busy":false,"error":"","more":false}')
      await act(async () => latest.setProfilePosts([{ id: 3 } as Post]))
      expect(host.textContent).toContain('"posts":[3]')
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})
