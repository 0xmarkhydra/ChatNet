import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Session } from '../features/auth/session'
import type { ToastKind } from '../features/notifications/toast'

export type ApiRequest = (path: string, init?: RequestInit) => Promise<Response>
export type Notice = (message: string, kind?: ToastKind) => void
export type AppDataContext = {
  session: Session | null
  sessionRef: RefObject<Session | null>
  apiFetch: ApiRequest
  setStatus: Dispatch<SetStateAction<string>>
  setNotice: Notice
}
