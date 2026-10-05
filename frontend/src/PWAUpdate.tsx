import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { watchPWAUpdates } from './pwa-updates'

export function PWAUpdate() {
  const [available, setAvailable] = useState(false)
  const [applying, setApplying] = useState(false)
  const updates = useRef<ReturnType<typeof watchPWAUpdates> | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const watcher = watchPWAUpdates(() => setAvailable(true))
    updates.current = watcher
    return () => watcher.stop()
  }, [])

  useEffect(() => {
    if (!applying) return
    const timeout = window.setTimeout(() => setApplying(false), 10_000)
    return () => window.clearTimeout(timeout)
  }, [applying])

  if (!available) return null

  return (
    <aside className="pwa-update" aria-label="Cập nhật ứng dụng">
      <span role="status">Đã có bản cập nhật mới</span>
      <button type="button" disabled={applying} onClick={() => {
        setApplying(true)
        updates.current?.apply()
      }}>
        <RefreshCw size={18} aria-hidden="true" />
        {applying ? 'Đang tải lại...' : 'Tải lại'}
      </button>
    </aside>
  )
}
