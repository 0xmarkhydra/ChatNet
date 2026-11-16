import { Check, Eye, ShieldCheck } from 'lucide-react'
import type { UserPrivacy } from '../types'

type Props = {
  privacy: UserPrivacy | null
  privacyBusy: boolean
  privacyError: string
  retryPrivacy: () => void
  changePrivacy: (key: keyof UserPrivacy) => Promise<void>
}

const accessRows = [
  { key: 'searchableByUsername', title: 'Tìm bằng tên người dùng', subtitle: 'Cho phép tìm bằng @username' },
  { key: 'searchableByName', title: 'Tìm theo tên hiển thị', subtitle: 'Xuất hiện khi tìm tên của bạn' },
  { key: 'allowFriendRequests', title: 'Lời mời kết bạn', subtitle: 'Cho phép gửi lời mời mới' },
  { key: 'showOnlineStatus', title: 'Trạng thái trực tuyến', subtitle: 'Hiển thị khi đang hoạt động' },
] as const

export default function ProfileEditorPrivacyCard({ privacy, privacyBusy, privacyError, retryPrivacy, changePrivacy }: Props) {
  return (
        <section className="profile-editor-privacy-card" aria-label="Quyền hiển thị">
          <div className="profile-editor-privacy-heading"><Eye size={22} aria-hidden="true" /><h2>Quyền hiển thị</h2></div>
          <p>Chọn cách người khác tìm và kết nối với bạn.</p>

          {privacyError && <div role="alert" className="profile-editor-privacy-error">{privacyError}
            <button type="button" onClick={retryPrivacy}>Thử lại</button>
          </div>}
          {privacy && <div className="profile-editor-privacy-rows">
            {accessRows.map(row => (
              <div className="profile-editor-privacy-row" key={row.key}>
                <div><strong>{row.title}</strong><small>{row.subtitle}</small></div>
                <button type="button" role="switch" className={privacy[row.key] ? 'is-on' : ''}
                  aria-label={row.title} aria-checked={privacy[row.key]} disabled={privacyBusy}
                  onClick={() => void changePrivacy(row.key)}>
                  <span>{privacy[row.key] ? 'Bật' : 'Tắt'}</span><i aria-hidden="true"><Check size={11}/></i>
                </button>
              </div>
            ))}
          </div>}
          <p className="profile-editor-privacy-foot"><ShieldCheck size={16} aria-hidden="true" /> Cài đặt này lưu riêng trên máy chủ, không phụ thuộc nút Lưu hồ sơ.</p>
        </section>
  )
}
