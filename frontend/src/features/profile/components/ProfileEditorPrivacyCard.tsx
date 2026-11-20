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
        <section className="profile-editor-privacy-card min-[761px]:min-h-[384px] min-[761px]:px-[18px] min-[761px]:pt-[18px] min-[761px]:pb-[25px]" aria-label="Quyền hiển thị">
          <div className="profile-editor-privacy-heading min-[761px]:mx-[5px] min-[761px]:flex min-[761px]:min-h-[31px] min-[761px]:items-center min-[761px]:gap-2.5 min-[761px]:[&>svg]:shrink-0 min-[761px]:[&>svg]:text-[#2563eb]"><Eye size={22} aria-hidden="true" /><h2>Quyền hiển thị</h2></div>
          <p className="min-[761px]:mx-1.5 min-[761px]:mt-[17px] min-[761px]:mb-[18px] min-[761px]:text-[13px] min-[761px]:text-[#8694ac]">Chọn cách người khác tìm và kết nối với bạn.</p>

          {privacyError && <div role="alert" className="profile-editor-privacy-error min-[761px]:mb-[9px] min-[761px]:rounded-[9px] min-[761px]:bg-[#fff0f0] min-[761px]:p-2.5 min-[761px]:text-xs min-[761px]:text-[#af3535]">{privacyError}
            <button type="button" onClick={retryPrivacy}>Thử lại</button>
          </div>}
          {privacy && <div className="profile-editor-privacy-rows min-[761px]:grid min-[761px]:gap-3">
            {accessRows.map(row => (
              <div className="profile-editor-privacy-row min-[761px]:flex min-[761px]:min-h-[51px] min-[761px]:items-center min-[761px]:justify-between min-[761px]:gap-2 min-[761px]:rounded-[10px] min-[761px]:bg-[#f8fafe] min-[761px]:px-3 min-[761px]:py-[7px]" key={row.key}>
                <div className="min-[761px]:flex min-[761px]:min-w-0 min-[761px]:flex-1 min-[761px]:flex-col min-[761px]:gap-1"><strong className="min-[761px]:text-xs min-[761px]:font-semibold min-[761px]:leading-[1.3] min-[761px]:text-[#435879]">{row.title}</strong><small className="min-[761px]:text-[10px] min-[761px]:leading-[1.25] min-[761px]:text-[#95a2b7]">{row.subtitle}</small></div>
                <button type="button" role="switch" className={privacy[row.key] ? 'is-on' : ''}
                  aria-label={row.title} aria-checked={privacy[row.key]} disabled={privacyBusy}
                  onClick={() => void changePrivacy(row.key)}>
                  <span>{privacy[row.key] ? 'Bật' : 'Tắt'}</span><i aria-hidden="true"><Check size={11}/></i>
                </button>
              </div>
            ))}
          </div>}
          <p className="profile-editor-privacy-foot min-[761px]:mx-[3px] min-[761px]:mt-3.5 min-[761px]:flex min-[761px]:items-start min-[761px]:gap-[7px] min-[761px]:text-[10px] min-[761px]:leading-[1.35] min-[761px]:text-[#9aa5b6] min-[761px]:[&_svg]:shrink-0"><ShieldCheck size={16} aria-hidden="true" /> Cài đặt này lưu riêng trên máy chủ, không phụ thuộc nút Lưu hồ sơ.</p>
        </section>
  )
}