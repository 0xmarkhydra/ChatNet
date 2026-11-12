import type { ReactNode, RefObject } from 'react'
import { useApiRequest } from '../hooks/useApiRequest'
import { ApiContext } from '../../shared/context/ApiContext'
import { NoticeProvider } from '../../shared/context/NoticeContext'
import { SessionContext } from '../../shared/context/SessionContext'
import type { createSessionClient } from '../../features/auth/lib/session'
import type { SessionResponseCache } from '../../shared/lib/sessionCache'
import type { Session } from '../../shared/types/session'

type AuthedProvidersProps = {
  session: Session
  sessionRef: RefObject<Session | null>
  sessionClient: ReturnType<typeof createSessionClient>
  responseCache: RefObject<SessionResponseCache>
  children: ReactNode
}

/** Cross-cutting services for the signed-in app: session, API client and toasts. */
export default function AuthedProviders({
  session,
  sessionRef,
  sessionClient,
  responseCache,
  children,
}: AuthedProvidersProps) {
  const api = useApiRequest({ session, sessionRef, sessionClient, responseCache })
  return (
    <SessionContext.Provider value={{ session, sessionRef }}>
      <ApiContext.Provider value={api}>
        <NoticeProvider>{children}</NoticeProvider>
      </ApiContext.Provider>
    </SessionContext.Provider>
  )
}
