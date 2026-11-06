import { useEffect, useState } from 'react'
import { desktopBridge, type DesktopUpdateState } from './desktop'
import { hasPendingDesktopWork } from './desktopUpdateSafety'

export default function DesktopUpdateNotice() {
  const [state, setState] = useState<DesktopUpdateState | null>(null)
  const [busy, setBusy] = useState(false)
  const [postponed, setPostponed] = useState('')

  useEffect(() => {
    const bridge = desktopBridge().updates
    let mounted = true
    const unsubscribe = bridge.onStatus((update) => { if (mounted) setState(update) })
    void bridge.state().then((value) => { if (mounted) setState(value) })
      .catch(() => undefined)
    return () => { mounted = false; unsubscribe() }
  }, [])

  if (!state || !['available', 'downloading', 'downloaded', 'error'].includes(state.status)) return null
  const { status, version, progress } = state
  const reminderId = `${status}:${version}`
  if (postponed === reminderId && status !== 'downloading') return null
  const title = status === 'downloaded' ? 'Đã tải bản cập nhật'
    : status === 'available' ? 'Có phiên bản SocCO mới'
      : status === 'downloading' ? 'Đang tải bản cập nhật' : 'Không kiểm tra được cập nhật'
  const label = status === 'available' ? 'Tải bản mới'
    : status === 'downloaded' ? 'Cài đặt và khởi động lại'
      : status === 'error' ? 'Thử lại' : ''
  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      const updates = desktopBridge().updates
      if (status === 'available') await updates.download()
      else if (status === 'error') await updates.check()
      else if (status === 'downloaded') {
        if (hasPendingDesktopWork()) {
          window.alert('Vui lòng kết thúc cuộc gọi và xử lý hết tin nhắn đang chờ hoặc chưa xác nhận trước khi cài cập nhật.')
          return
        }
        await updates.install({ hasPendingWork: false })
      }
    } catch {
      // Main owns the failure state and never installs without confirmation.
    } finally { setBusy(false) }
  }
  return (
    <aside className="desktop-update-notice" aria-live="polite" aria-label="Cập nhật SocCO">
      <strong>{title}</strong>
      <span>{status === 'downloading' ? `Đã tải ${progress}%`
        : status === 'error' ? 'Kiểm tra kết nối rồi thử lại.'
          : `Phiên bản ${version || 'mới'} đã sẵn sàng.`}</span>
      {status === 'downloading' && <progress value={progress} max="100" aria-label="Tiến trình tải bản cập nhật" />}
      {label && <button type="button" disabled={busy} onClick={() => void run()}>{label}</button>}
      {status !== 'downloading' && <button className="desktop-update-postpone" type="button"
        onClick={() => setPostponed(reminderId)}>Để sau</button>}
      <small>Cập nhật chỉ được cài khi bạn đồng ý. Dữ liệu và phiên đăng nhập được giữ lại.</small>
    </aside>
  )
}
