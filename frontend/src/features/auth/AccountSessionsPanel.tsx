import type { ManagedAccountSession } from './types'

type Props = {
  sessionsBusy: boolean
  canManageSessions: boolean
  sessionsOpen: boolean
  setSessionsOpen: (open: boolean) => void
  fetchAccountSessions: () => Promise<void>
  sessionsError: string
  managedSessions: ManagedAccountSession[]
  revokeAccountSessions: (id?: string) => Promise<void>
}

export default function AccountSessionsPanel({
  sessionsBusy, canManageSessions, sessionsOpen, setSessionsOpen,
  fetchAccountSessions, sessionsError, managedSessions, revokeAccountSessions,
}: Props) {
  return (
    <>
      <div className="settings-row">
        <div>
          <strong>Thiết bị đã đăng nhập</strong>
          <small>Kiểm tra và thu hồi những phiên đăng nhập không còn sử dụng.</small>
        </div>
        <button type="button" className="settings-action"
          disabled={sessionsBusy || !canManageSessions}
          onClick={() => {
            if (sessionsOpen) setSessionsOpen(false)
            else void fetchAccountSessions()
          }}>
          {sessionsBusy ? 'Đang xử lý...' : sessionsOpen ? 'Thu gọn' : 'Xem thiết bị'}
        </button>
      </div>
      {sessionsError && <div className="settings-row" role="alert">
        <small>{sessionsError}</small>
        <button type="button" className="settings-action" disabled={sessionsBusy}
          onClick={() => void fetchAccountSessions()}>Thử lại</button>
      </div>}
      {sessionsOpen && (
        <div className="account-sessions-panel">
          <p>Phiên đã thu hồi sẽ bị server từ chối. Thiết bị mất mạng cập nhật trạng thái khi kết nối lại.</p>
          {managedSessions.length === 0 && <small>Không có phiên đang hoạt động.</small>}
          {managedSessions.map((device) => (
            <div className="account-session-item" key={device.id}>
              <div className="account-session-details">
                <strong>{device.current ? 'Thiết bị này' : device.userAgent || 'Trình duyệt khác'}</strong>
                {device.current && <small>{device.userAgent || 'Trình duyệt hiện tại'}</small>}
                <small>Hoạt động: {new Date(device.lastSeenAt).toLocaleString('vi-VN')}</small>
              </div>
              <button type="button" className="settings-action" disabled={sessionsBusy}
                onClick={() => void revokeAccountSessions(device.id)}>
                {device.current ? 'Đăng xuất' : 'Thu hồi'}
              </button>
            </div>
          ))}
          {managedSessions.some((device) => !device.current) && (
            <button type="button" className="settings-action account-revoke-others"
              disabled={sessionsBusy} onClick={() => void revokeAccountSessions()}>
              Đăng xuất tất cả thiết bị khác
            </button>
          )}
        </div>
      )}
    </>
  )
}
