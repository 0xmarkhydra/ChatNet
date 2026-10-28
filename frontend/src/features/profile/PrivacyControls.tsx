import type { Dispatch, SetStateAction } from 'react'
import type { UserPrivacy } from './types'

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
  return (
    <>
              <div className="settings-row">
                <div>
                  <strong>Quyền riêng tư tài khoản</strong>
                  <small>Kiểm soát ai có thể tìm, gửi lời mời và thấy bạn trực tuyến. Thiết lập lưu trên máy chủ.</small>
                </div>
              </div>
              {privacyLoading && <div className="settings-row" role="status">Đang tải quyền riêng tư...</div>}
              {privacyError && <div className="settings-row" role="alert">
                <span>{privacyError}</span>
                <button type="button" className="settings-action" onClick={() => setPrivacyRetry((n) => n + 1)}>Thử lại</button>
              </div>}
              {privacy && ([
                ['searchableByUsername', 'Cho phép tìm bằng username', 'Người khác có thể tìm @username của bạn.'],
                ['searchableByName', 'Cho phép tìm bằng tên', 'Tên hiển thị của bạn có thể xuất hiện trong kết quả.'],
                ['searchableByEmail', 'Cho phép tìm bằng email', 'Chỉ tìm bằng email khớp chính xác; địa chỉ email không được hiển thị.'],
                ['allowFriendRequests', 'Cho phép lời mời mới', 'Tắt để ngăn lời mời kết bạn mới từ người khác.'],
                ['showOnlineStatus', 'Hiển thị trạng thái online', 'Ẩn sự hiện diện trong danh sách và kết quả tìm kiếm.'],
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
