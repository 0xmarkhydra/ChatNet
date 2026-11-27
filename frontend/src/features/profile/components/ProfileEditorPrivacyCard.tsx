import { useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()

  return (
        <section className="profile-editor-privacy-card app-desktop:min-h-[384px] app-desktop:px-[18px] app-desktop:pt-[18px] app-desktop:pb-[25px]" aria-label={trUi("profile.visibility")}>
          <div className="profile-editor-privacy-heading app-desktop:mx-[5px] app-desktop:flex app-desktop:min-h-[31px] app-desktop:items-center app-desktop:gap-2.5 app-desktop:[&>svg]:shrink-0 app-desktop:[&>svg]:text-primary"><Eye size={22} aria-hidden="true" /><h2>{trUi("profile.visibility")}</h2></div>
          <p className="app-desktop:mx-1.5 app-desktop:mt-[17px] app-desktop:mb-[18px] app-desktop:text-[13px] app-desktop:text-[#8694ac]">{trUi("settings.privacyIntro")}</p>

          {privacyError && <div role="alert" className="profile-editor-privacy-error app-desktop:mb-[9px] app-desktop:rounded-[9px] app-desktop:bg-[#fff0f0] app-desktop:p-2.5 app-desktop:text-xs app-desktop:text-[#af3535]">{privacyError}
            <button type="button" onClick={retryPrivacy}>{trUi("common.retry")}</button>
          </div>}
          {privacy && <div className="profile-editor-privacy-rows app-desktop:grid app-desktop:gap-3">
            {accessRows.map(row => (
              <div className="profile-editor-privacy-row app-desktop:flex app-desktop:min-h-[51px] app-desktop:items-center app-desktop:justify-between app-desktop:gap-2 app-desktop:rounded-[10px] app-desktop:bg-surface-input app-desktop:px-3 app-desktop:py-[7px]" key={row.key}>
                <div className="app-desktop:flex app-desktop:min-w-0 app-desktop:flex-1 app-desktop:flex-col app-desktop:gap-1"><strong className="app-desktop:text-ui-caption app-desktop:font-[690] app-desktop:leading-[1.3] app-desktop:text-[#435879]">{row.title}</strong><small className="app-desktop:text-[10px] app-desktop:leading-[1.25] app-desktop:text-[#95a2b7]">{row.subtitle}</small></div>
                <button type="button" role="switch" className={privacy[row.key] ? 'is-on' : ''}
                  aria-label={row.title} aria-checked={privacy[row.key]} disabled={privacyBusy}
                  onClick={() => void changePrivacy(row.key)}>
                  <span>{privacy[row.key] ? trUi("common.on") : trUi("common.off")}</span><i aria-hidden="true"><Check size={11}/></i>
                </button>
              </div>
            ))}
          </div>}
          <p className="profile-editor-privacy-foot app-desktop:mx-[3px] app-desktop:mt-3.5 app-desktop:flex app-desktop:items-start app-desktop:gap-[7px] app-desktop:text-[10px] app-desktop:leading-[1.35] app-desktop:text-[#9aa5b6] app-desktop:[&_svg]:shrink-0"><ShieldCheck size={16} aria-hidden="true" /> Cài đặt này lưu riêng trên máy chủ, không phụ thuộc nút Lưu hồ sơ.</p>
        </section>
  )
}