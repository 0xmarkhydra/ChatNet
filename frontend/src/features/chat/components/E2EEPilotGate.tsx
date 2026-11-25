import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import type { ApiRequest } from '../../../shared/types/api'
import type { ConversationEncryptionMode } from '../types'

// Avoid loading the large experimental MLS crypto engine for normal chats.
// The server must authorize this pilot; query params do NOT enable crypto.
const E2EEPilotPanel = lazy(() => import('./E2EEPilotPanel'))

type Props = {
  conversationId: number
  userId: number
  otherUserId: number
  request: ApiRequest
  onModeChange: (mode: ConversationEncryptionMode) => void
}

export default function E2EEPilotGate(props: Props) {
  const { conversationId, request, onModeChange } = props
  const [enabled, setEnabled] = useState(false)
  // The request helper changes on app renders, but this gate belongs to one keyed visit.
  const latestRequest = useLatest(request)
  const requestForVisit = useCallback<ApiRequest>((path, init) => latestRequest.current(path, init), [latestRequest])

  useEffect(() => {
    let active = true
    const startup = window.setTimeout(() => {
      void requestForVisit(`/api/conversations/${conversationId}/e2ee/status`, { cache: 'no-store' })
        .then(async response => {
          if (!response.ok) return
          const result: unknown = await response.json()
          if (!active || !result || typeof result !== 'object') return
          if ('mode' in result &&
              (result.mode === 'legacy' || result.mode === 'e2ee')) {
            onModeChange('autoEnabled' in result && result.autoEnabled === true
              ? 'pending' : result.mode)
            setEnabled(('pilotEnabled' in result && result.pilotEnabled === true) ||
              result.mode === 'e2ee')
          }
        })
        .catch(() => {
          // This must not silently authorize a plaintext send. The legacy
          // composer independently checks /e2ee/status and fails closed.
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(startup)
    }
  }, [conversationId, onModeChange, requestForVisit])

  return enabled
    ? <Suspense fallback={null}><E2EEPilotPanel {...props} request={requestForVisit} /></Suspense>
    : null
}
