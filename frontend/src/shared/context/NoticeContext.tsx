import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { inferToastKind, type ToastKind, type ToastNotice } from '../utils/toast'

export type NoticeContextValue = {
  /** The toast currently shown, if any. */
  notice: ToastNotice | null
  /** Show a toast; an empty message clears it. The kind is inferred when omitted. */
  setNotice: (message: string, kind?: ToastKind) => void
  dismissNotice: () => void
}

const NoticeContext = createContext<NoticeContextValue | null>(null)

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNoticeState] = useState<ToastNotice | null>(null)

  function setNotice(message: string, kind?: ToastKind) {
    const clean = message.trim()
    if (!clean) {
      setNoticeState(null)
      return
    }
    setNoticeState({
      id: Date.now(),
      message: clean,
      kind: kind || inferToastKind(clean),
    })
  }

  useEffect(() => {
    if (!notice) return
    const timeout =
      notice.kind === 'error' ? 8000 : notice.kind === 'warning' ? 6000 : 4500
    const timer = window.setTimeout(() => {
      setNoticeState((current) => (current?.id === notice.id ? null : current))
    }, timeout)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <NoticeContext.Provider value={{ notice, setNotice, dismissNotice: () => setNoticeState(null) }}>
      {children}
    </NoticeContext.Provider>
  )
}

export function useNotice(): NoticeContextValue {
  const value = useContext(NoticeContext)
  if (!value) throw new Error('useNotice must be used inside NoticeProvider')
  return value
}
