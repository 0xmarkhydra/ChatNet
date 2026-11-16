// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { AppDataContext } from '../../../shared/types/api'
import type { FriendConnection } from '../types'
import { useContactData } from './useContactData'

describe('contact session isolation', () => {
  it('resets previous-account contacts during render and rejects stale setters after A → B → A', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const context = {
      session: null,
      sessionRef: { current: null },
      apiFetch: async () => new Response('[]'),
      setStatus: () => {},
      setNotice: () => {},
    } as unknown as AppDataContext
    let oldSetter: ((value: FriendConnection[]) => void) | undefined
    let currentSetter: ((value: FriendConnection[]) => void) | undefined
    function Probe({ id }: { id: string }) {
      const data = useContactData({ ...context, session: { sessionId: id } as AppDataContext['session'] })
      useLayoutEffect(() => {
        currentSetter = data.setFriends
        if (id === 'a' && !oldSetter) oldSetter = data.setFriends
      })
      return <div>{data.friends.map(friend => friend.id).join(',')}</div>
    }

    try {
      await act(async () => root.render(<Probe id="a" />))
      await act(async () => currentSetter?.([{ id: 1 } as FriendConnection]))
      expect(host.textContent).toBe('1')
      await act(async () => root.render(<Probe id="b" />))
      expect(host.textContent).toBe('')
      await act(async () => currentSetter?.([{ id: 2 } as FriendConnection]))
      expect(host.textContent).toBe('2')
      await act(async () => root.render(<Probe id="a" />))
      expect(host.textContent).toBe('')
      await act(async () => oldSetter?.([{ id: 99 } as FriendConnection]))
      expect(host.textContent).toBe('')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
