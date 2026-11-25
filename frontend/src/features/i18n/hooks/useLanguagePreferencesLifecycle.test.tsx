// @vitest-environment jsdom
import { act, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { Session } from '../../../shared/types/session'
import type { ApiRequest } from '../../../shared/types/api'
import { useLanguagePreferencesLifecycle } from './useLanguagePreferencesLifecycle'

describe('useLanguagePreferencesLifecycle', () => {
  it('restores cached preferences and reconciles server settings per session', async () => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
      clear: () => { storage.clear() },
    } })
    const previous = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const session = { token: 'secret', sessionId: 'session-A', user: { id: 44 } } as Session
    localStorage.setItem('chatnet-preferences:44', JSON.stringify({
      targetLanguage: 'fr', autoTranslate: false, appLocale: 'vi',
    }))
    const calls: string[] = []
    const apiFetch: ApiRequest = async path => {
      calls.push(path)
      return Response.json({ targetLanguage: 'en', autoTranslate: true, appLocale: 'vi' })
    }
    function Probe({ current }: { current: Session | null }) {
      const [loaded, setLoaded] = useState(false)
      const [auto, setAuto] = useState(true)
      const [target, setTarget] = useState('en')
      const [locale, setLocale] = useState('auto')
      const revision = useRef(0)
      useLanguagePreferencesLifecycle({
        session: current, apiFetch, preferenceRevision: revision,
        setTranslationPreferencesLoaded: setLoaded,
        setAutoTranslate: setAuto, setTargetLanguage: setTarget, setAppLocale: setLocale,
      })
      return <span>{target}/{auto ? 'on' : 'off'}/{locale}/{loaded ? 'ready' : 'loading'}</span>
    }
    try {
      await act(async () => root.render(<Probe current={session} />))
      expect(calls).toContain('/api/preferences')
      expect(host.textContent).toBe('en/on/vi/ready')
      await act(async () => root.render(<Probe current={null} />))
      expect(host.textContent).toContain('en/on/')
      expect(host.textContent).toContain('/loading')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previous
    }
  })
})