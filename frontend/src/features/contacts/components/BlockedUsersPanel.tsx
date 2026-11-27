import { useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()
  return (
    <>
              <div className="settings-row">
                <div><strong>{trUi('contacts.blockedUsers')}</strong><small>{trUi('contacts.blockedHint')}</small></div>
                <button type="button" className="settings-action" disabled={blockedBusy}
                  onClick={() => blockedOpen ? setBlockedOpen(false) : void loadBlockedUsers()}>
                  {trUi(blockedOpen ? 'contacts.collapse' : 'contacts.viewList')}
                </button>
              </div>
              {blockedError && <div className="settings-row" role="alert">
                <small>{blockedError === 'Không tải được danh sách chặn.' ? trUi('contacts.blockedLoadFailed') : blockedError === 'Không thể bỏ chặn. Hãy thử lại.' ? trUi('contacts.unblockFailed') : blockedError}</small>
                <button type="button" className="settings-action" disabled={blockedBusy}
                  onClick={() => void loadBlockedUsers()}>{trUi('common.retry')}</button>
              </div>}
              {blockedOpen && (
                <div className="account-sessions-panel">
                  {blockedUsers.length === 0 && <p>{trUi('contacts.noBlocked')}</p>}
                  {blockedUsers.map((item) => (
                    <div className="account-session-item" key={item.id}>
                      <div className="account-session-details">
                        <strong>{item.displayName || item.username}</strong>
                        <small>@{item.username}</small>
                      </div>
                      <button type="button" className="settings-action" disabled={blockedBusy}
                        onClick={() => void unblockContact(item.id)}>{trUi('contacts.unblock')}</button>
                    </div>
                  ))}
                </div>
              )}
    </>
  )
}