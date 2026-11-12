import { createContext, useContext, type RefObject } from 'react'
import type { Session } from '../types/session'

export type SessionContextValue = {
  /** The signed-in session. The provider is only mounted while a session exists. */
  session: Session
  /** Latest session for async callbacks that must detect an account change. */
  sessionRef: RefObject<Session | null>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside the signed-in app')
  return value
}
