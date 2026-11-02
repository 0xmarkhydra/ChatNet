import { useEffect, useState } from 'react'
import App from '../app/App'
import DesktopScreenPicker from './DesktopScreenPicker'
import { parseSession, type Session } from '../features/auth/session'
import { clearChatPersistence, configureChatPersistenceStore } from '../features/chat/chatPersistence'
import { clearChatOutbox } from '../chatOutbox'
import { API } from '../shared/lib/config'
import { desktopBridge, initializeDesktopPlatform } from './desktop'

type Startup = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; session: Session | null }

export default function DesktopBootstrap() {
  const [attempt, setAttempt] = useState(0)
  const [startup, setStartup] = useState<Startup>({ phase: 'loading' })
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    setStartup({ phase: 'loading' })
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
      if (active) setStartup({ phase: 'ready', session })
    }
    void restore().catch((error: unknown) => {
      if (!active) return
      const detail = error instanceof Error ? error.message : ''
      const message = detail.includes('VAULT_')
        ? 'Không mở được kho phiên an toàn của hệ điều hành. Kiểm tra quyền Keychain hoặc tài khoản Windows rồi thử lại.'
        : detail.includes('DESKTOP_')
          ? 'Bản Desktop thiếu bridge hoặc cấu hình API không khớp. Hãy dùng đúng bộ cài SOCO.'
          : 'Chưa xác minh được phiên đăng nhập. Kiểm tra kết nối rồi thử lại. Tin đang chờ và bản nháp vẫn được giữ.'
      setStartup({ phase: 'error', message })
    })
    return () => { active = false; unsubscribe?.() }
  }, [attempt])

  if (startup.phase === 'ready') return <><App initialSession={startup.session} /><DesktopScreenPicker /></>
  return (
    <main className="desktop-startup" aria-live="polite">
      <h1>SOCO</h1>
      {startup.phase === 'loading' ? <p role="status">Đang khôi phục phiên an toàn…</p> : <>
        <p role="alert">{startup.message}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Thử lại</button>
      </>}
    </main>
  )
}
