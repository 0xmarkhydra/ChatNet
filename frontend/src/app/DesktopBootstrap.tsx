import { createUiTranslator, type UiCopyKey } from '@/shared/i18n/locale'
import { loadAppLocalePreference } from '../features/i18n'
import { useEffect, useState } from 'react'
import App from './App'
import DesktopScreenPicker from '../platform/DesktopScreenPicker'
import { parseSession, type Session } from '../features/auth/lib/session'
import { clearChatPersistence, configureChatPersistenceStore } from '../features/chat/lib/chatPersistence'
import { clearChatOutbox } from '../features/chat/lib/chatOutbox'
import { API } from '../shared/lib/config'
import { desktopBridge, initializeDesktopPlatform } from '../platform/desktop'

type Startup = { phase: 'loading' } | { phase: 'error'; message: UiCopyKey } | { phase: 'ready'; session: Session | null }

export default function DesktopBootstrap() {
  const trUi = createUiTranslator(loadAppLocalePreference())

  const [attempt, setAttempt] = useState(0)
  const [startupResult, setStartupResult] = useState<{ attempt: number; value: Startup }>({
    attempt: 0,
    value: { phase: 'loading' },
  })
  // Switching attempts shows loading immediately, without scheduling a
  // synchronous state update from the restore effect.
  const startup: Startup = startupResult.attempt === attempt
    ? startupResult.value
    : { phase: 'loading' }
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    async function restore() {
      // B01 stored Web credentials here. Never hydrate them into the Desktop session.
      localStorage.removeItem('chatnet-session')
      configureChatPersistenceStore(localStorage)
      await initializeDesktopPlatform()
      const bridge = desktopBridge()
      const info = await bridge.getPlatformInfo()
      if (!active) return
      if (API !== info.apiOrigin) throw new Error('DESKTOP_API_MISMATCH')
      unsubscribe = bridge.auth.onExpired((_sessionId, userId) => {
        // Also purge revocation discovered before App mounts, not only while logged in.
        if (!active || !Number.isSafeInteger(userId) || userId <= 0) return
        clearChatPersistence(userId)
        clearChatPersistence(userId, sessionStorage)
        clearChatOutbox(userId)
      })
      const result = await bridge.auth.restore()
      const session = result === null ? null : parseSession(result)
      if (result !== null && (!session || session.refreshToken !== undefined)) throw new Error('AUTH_INVALID_RESPONSE')
      if (active) setStartupResult({ attempt, value: { phase: 'ready', session } })
    }
    void restore().catch((error: unknown) => {
      if (!active) return
      const detail = error instanceof Error ? error.message : ''
      const message: UiCopyKey = detail.includes('VAULT_')
        ? 'common.ui.desktopVault'
        : detail.includes('DESKTOP_')
          ? 'common.ui.desktopMismatch'
          : 'common.ui.desktopSessionFailed'
      setStartupResult({ attempt, value: { phase: 'error', message } })
    })
    return () => { active = false; unsubscribe?.() }
  }, [attempt])

  if (startup.phase === 'ready') return <><App initialSession={startup.session} /><DesktopScreenPicker /></>
  return (
    <main className="desktop-startup" aria-live="polite">
      <h1>SocCO</h1>
      {startup.phase === 'loading' ? <p role="status">{trUi("common.ui.desktopRestoring")}</p> : <>
        <p role="alert">{trUi(startup.message)}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>{trUi("common.retry")}</button>
      </>}
    </main>
  )
}