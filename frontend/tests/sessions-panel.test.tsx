// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, StrictMode, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useSessionsPanel } from '../src/features/auth/hooks/useSessionsPanel'
import type { Session } from '../src/features/auth/lib/session'

describe('useSessionsPanel account isolation', () => {
  for (const strict of [false, true]) {
    it(`resets state and rejects stale callbacks in ${strict ? 'StrictMode' : 'normal mode'}`, async () => {
      const host = document.createElement('div')
      document.body.append(host)
      const root = createRoot(host)
      const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
      const snapshots: ReturnType<typeof useSessionsPanel>[] = []

      function Probe({ scope }: { scope: string | null }) {
        const panel = useSessionsPanel({
          session: scope === null ? null : { sessionId: scope } as Session,
        })
        useLayoutEffect(() => { snapshots.push(panel) })
        return <div>{panel.sessionsOpen ? 'open' : 'closed'}:{panel.sessionsError}</div>
      }
      const render = async (scope: string | null) => {
        await act(async () => root.render(strict
          ? <StrictMode><Probe scope={scope} /></StrictMode>
          : <Probe scope={scope} />))
        return snapshots.at(-1)!
      }
      try {
        const first = await render('A')
        await act(async () => {
          first.setSessionsOpen(true)
          first.setSessionsError('A-only')
        })
        expect(host.textContent).toBe('open:A-only')
        const second = await render('B')
        expect(host.textContent).toBe('closed:')
        await act(async () => {
          first.setSessionsOpen(true)
          first.setSessionsError('late A')
        })
        expect(host.textContent).toBe('closed:')
        await act(async () => second.setSessionsOpen(true))
        expect(host.textContent).toBe('open:')
        const returned = await render('A')
        expect(host.textContent).toBe('closed:')
        await act(async () => first.setSessionsOpen(true))
        expect(host.textContent).toBe('closed:')
        await act(async () => returned.setSessionsOpen(true))
        expect(host.textContent).toBe('open:')
        await render(null)
        expect(host.textContent).toBe('closed:')
      } finally {
        await act(async () => root.unmount())
        host.remove()
        ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
      }
    })
  }
})
