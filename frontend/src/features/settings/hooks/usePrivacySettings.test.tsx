// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { Session } from '../../../shared/types/session'
import { usePrivacySettings } from './usePrivacySettings'

type UserPrivacy = NonNullable<ReturnType<typeof usePrivacySettings>['privacy']>

describe('privacy session isolation', () => {
  it('hides the previous account immediately and rejects its late response and setter', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const pending: Array<(response: Response) => void> = []
    const apiFetch = () => new Promise<Response>(resolve => { pending.push(resolve) })
    const settings = { searchableByUsername: true, searchableByName: true, searchableByEmail: false, allowFriendRequests: true, showOnlineStatus: false } as UserPrivacy
    let oldSetter: ((value: UserPrivacy | null) => void) | undefined
    function Probe({ id }: { id: string }) {
      const state = usePrivacySettings({ apiFetch, session: { sessionId: id, token: id } as Session })
      useLayoutEffect(() => { if (id === 'a') oldSetter = state.setPrivacy })
      return <div>{state.privacy ? 'loaded' : 'empty'}</div>
    }

    try {
      await act(async () => root.render(<Probe id="a" />))
      await act(async () => pending[0](new Response(JSON.stringify(settings))))
      expect(host.textContent).toBe('loaded')
      await act(async () => root.render(<Probe id="b" />))
      expect(host.textContent).toBe('empty')
      await act(async () => oldSetter?.(settings))
      expect(host.textContent).toBe('empty')
      await act(async () => pending[1](new Response(JSON.stringify({ ...settings, showOnlineStatus: true }))))
      expect(host.textContent).toBe('loaded')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
