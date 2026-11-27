import { useEffect, useState } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import { useLatest } from '../../../shared/hooks/useLatest'
import type { FriendSearchResult } from '../../contacts'
import { listExplorePeople } from '../api/explore'

export function useExplorePeople(request: ApiRequest, active: boolean) {
  const requestRef = useLatest(request)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; items: FriendSearchResult[]; error: string }>({ attempt: -1, items: [], error: '' })
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    void listExplorePeople(requestRef.current, controller.signal).then(
      items => { if (!controller.signal.aborted) setResult({ attempt, items, error: '' }) },
      (error: unknown) => { if (!controller.signal.aborted) setResult({ attempt, items: [], error: error instanceof Error && error.message ? error.message : 'Không tải được gợi ý kết nối. Hãy kiểm tra kết nối mạng.' }) },
    )
    return () => controller.abort()
  }, [active, attempt, requestRef])
  return {
    items: result.items,
    loading: active && result.attempt !== attempt,
    error: result.attempt === attempt ? result.error : '',
    retry: () => setAttempt(value => value + 1),
  }
}