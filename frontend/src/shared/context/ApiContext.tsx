import { createContext, useContext, type RefObject } from 'react'
import type { ApiRequest } from '../types/api'

export type ApiContextValue = {
  /** Authenticated request helper bound to the current session. */
  apiFetch: ApiRequest
  pendingRequests: RefObject<Set<symbol>>
  mutationRequests: RefObject<Map<string, Promise<Response>>>
}

export const ApiContext = createContext<ApiContextValue | null>(null)

export function useApi(): ApiContextValue {
  const value = useContext(ApiContext)
  if (!value) throw new Error('useApi must be used inside the signed-in app')
  return value
}
