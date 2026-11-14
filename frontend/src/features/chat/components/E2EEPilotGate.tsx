import { lazy, Suspense, useEffect, useState } from 'react'
import type { ApiRequest } from '../../../shared/types/api'

// Avoid loading the large experimental MLS crypto engine for normal chats.
// The server must authorize this pilot; query params do NOT enable crypto.
const E2EEPilotPanel = lazy(() => import('./E2EEPilotPanel'))

type Props = {
  conversationId: number
  userId: number
  otherUserId: number
  request: ApiRequest
  onModeChange: (mode: 'unknown' | 'legacy' | 'pending' | 'e2ee') => void
}

export default function E2EEPilotGate(props: Props) {
  const { conversationId, request, onModeChange } = props
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let active = true
    const startup = window.setTimeout(() => {
      void request(`/api/conversations/${conversationId}/e2ee/status`, { cache: 'no-store' })
        .then(async response => {
          if (!response.ok) return
          const result: unknown = await response.json()
          if (!active || !result || typeof result !== 'object') return
          if ('mode' in result &&
              (result.mode === 'legacy' || result.mode === 'e2ee')) {
            onModeChange(result.mode === 'legacy' &&
              'autoEnabled' in result && result.autoEnabled === true
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
      onModeChange('unknown')
    }
  }, [conversationId, onModeChange, request])

  return enabled
    ? <Suspense fallback={null}><E2EEPilotPanel {...props} /></Suspense>
    : null
}
