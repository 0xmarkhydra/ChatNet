import { useUiTranslation } from '@/shared/i18n/locale'
import type { Dispatch, SetStateAction } from 'react'
import type { UserPrivacy } from '../types'

type Props = {
  privacyLoading: boolean
  privacyError: string
  setPrivacyRetry: Dispatch<SetStateAction<number>>
  privacy: UserPrivacy | null
  privacyBusy: boolean
  changePrivacy: (key: keyof UserPrivacy) => Promise<void>
}

export default function PrivacyControls({
  privacyLoading,
  privacyError,
  setPrivacyRetry,
  privacy,
  privacyBusy,
  changePrivacy,
}: Props) {
  const trUi = useUiTranslation()

  return (
    <>
              <div className="settings-row">
                <div>
                  <strong>{trUi('settings.accountPrivacy')}</strong>
                  <small>{trUi('settings.accountPrivacyHint')}</small>
                </div>
              </div>

              {privacyError && <div className="settings-row" role="alert">
                <span>{privacyError === 'Lưu thất bại. Cài đặt trước đó vẫn được giữ.' ? trUi('settings.saveFailed') : privacyError}</span>
                <button type="button" className="settings-action" onClick={() => setPrivacyRetry((n) => n + 1)}>{trUi("common.retry")}</button>
              </div>}
              {privacy && ([
                ['searchableByUsername', trUi('settings.usernameSearch'), trUi('settings.usernameHint')],
                ['searchableByName', trUi('settings.allowNameSearch'), trUi('settings.nameHint')],
                ['searchableByEmail', trUi('settings.emailSearch'), trUi('settings.emailHint')],
                ['allowFriendRequests', trUi('settings.newRequests'), trUi('settings.newRequestsHint')],
                ['showOnlineStatus', trUi('settings.onlineStatus'), trUi('settings.onlineHint')],
              ] as const).map(([key, label, hint]) => (
                <div className="settings-row" key={key}>
                  <div><strong>{label}</strong><small>{hint}</small></div>
                  <button
                    type="button"
                    className={`switch-button ${privacy[key] ? 'on' : ''}`}
                    role="switch"
                    aria-label={label}
                    aria-checked={privacy[key]}
                    disabled={privacyBusy}
                    onClick={() => void changePrivacy(key)}
                  ><span /></button>
                </div>
              ))}
    </>
  )
}