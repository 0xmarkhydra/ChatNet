

type Props = {
  blockedBusy: boolean
  blockedOpen: boolean
  setBlockedOpen: (open: boolean) => void
  loadBlockedUsers: () => Promise<void>
  blockedError: string
  blockedUsers: Array<{ id: number; username: string; displayName: string }>
  unblockContact: (id: number) => Promise<void>
}

export default function BlockedUsersPanel({
  blockedBusy,
  blockedOpen,
  setBlockedOpen,
  loadBlockedUsers,
  blockedError,
  blockedUsers,
  unblockContact,
}: Props) {
  return (
    <>
              <div className="settings-row">
                <div><strong>Người dùng đã chặn</strong><small>Quản lý những tài khoản không thể nhắn tin hoặc kết bạn với bạn.</small></div>
                <button type="button" className="settings-action" disabled={blockedBusy}
                  onClick={() => blockedOpen ? setBlockedOpen(false) : void loadBlockedUsers()}>
                  {blockedBusy ? 'Đang tải...' : blockedOpen ? 'Thu gọn' : 'Xem danh sách'}
                </button>
              </div>
              {blockedError && <div className="settings-row" role="alert">
                <small>{blockedError}</small>
                <button type="button" className="settings-action" disabled={blockedBusy}
                  onClick={() => void loadBlockedUsers()}>Thử lại</button>
              </div>}
              {blockedOpen && (
                <div className="account-sessions-panel">
                  {blockedUsers.length === 0 && <p>Chưa chặn tài khoản nào.</p>}
                  {blockedUsers.map((item) => (
                    <div className="account-session-item" key={item.id}>
                      <div className="account-session-details">
                        <strong>{item.displayName || item.username}</strong>
                        <small>@{item.username}</small>
                      </div>
                      <button type="button" className="settings-action" disabled={blockedBusy}
                        onClick={() => void unblockContact(item.id)}>Bỏ chặn</button>
                    </div>
                  ))}
                </div>
              )}
    </>
  )
}
