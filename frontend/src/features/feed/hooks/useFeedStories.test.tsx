// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { AppDataContext } from '../../../shared/types/api'
import { useFeedStories } from './useFeedStories'

describe('story refresh ordering', () => {
  it('ignores an older response that finishes after a newer refresh', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const pending: Array<(response: Response) => void> = []
    const session = { sessionId: 'session-a' }
    const context = {
      session,
      sessionRef: { current: session },
      apiFetch: () => new Promise<Response>(resolve => { pending.push(resolve) }),
      setStatus: () => {},
    } as unknown as AppDataContext
    let refresh: (() => Promise<void>) | undefined
    function Probe() {
      const result = useFeedStories(context)
      useLayoutEffect(() => { refresh = result.refreshStories })
      return <div>{result.stories.map(story => story.id).join(',')}</div>
    }

    try {
      await act(async () => root.render(<Probe />))
      await act(async () => { void refresh?.(); void refresh?.() })
      const story = (id: number) => ({ id, expiresAt: new Date(Date.now() + 60_000).toISOString() })
      await act(async () => pending[1](new Response(JSON.stringify([story(2)]))))
      await act(async () => pending[0](new Response(JSON.stringify([story(1)]))))
      expect(host.textContent).toBe('2')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
