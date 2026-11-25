// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { Session } from '../lib/session'
import { useAccountSessions } from './useAccountSessions'

describe('account session request ordering', () => {
  it('blocks a second revoke request before React renders the busy state', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
      resolveFetch = resolve
    }))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch
    let resolveFetch: ((response: Response) => void) | undefined
    const sessionRef = { current: { sessionId: 'A', refreshToken: 'test' } as Session }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const noop = vi.fn()
    let revoke: (() => Promise<void>) | undefined

    function Probe() {
      const actions = useAccountSessions({
        logout: noop, managedSessions: [], sessionRef, sessionsBusy: false,
        setManagedSessions: noop, setNotice: noop, setSessionsBusy: noop,
        setSessionsError: noop, setSessionsOpen: noop,
      })
      useLayoutEffect(() => { revoke = () => actions.revokeAccountSessions() })
      return null
    }

    try {
      await act(async () => root.render(<Probe />))
      let first: Promise<void> | undefined
      await act(async () => {
        first = revoke?.()
        await revoke?.()
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await act(async () => { resolveFetch?.(new Response('{}')); await first })
      await act(async () => { void revoke?.() })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await act(async () => resolveFetch?.(new Response('{}')))
    } finally {
      await act(async () => root.unmount())
      host.remove()
      globalThis.fetch = originalFetch
      window.confirm = originalConfirm
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
