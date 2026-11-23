import type { ReactNode } from 'react'
import { Eye, MapPin } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { ProfileMediaState } from '../types'

type Props = {
  profile: ProfileMediaState | null
  cover: ReactNode
  username: string
  displayName: string
  displayNameDraft: string
  usernameDraft: string
  bioDraft: string
  cityDraft: string
}

export default function ProfileEditorPreview({ profile, cover, username, displayName, displayNameDraft, usernameDraft, bioDraft, cityDraft }: Props) {
  const editName = displayNameDraft.trim() || profile?.displayName || displayName
  const editUsername = usernameDraft.trim().toLowerCase() || profile?.username || username
  return (
        <section className="profile-editor-preview-card app-desktop:h-[428px] app-desktop:px-4 app-desktop:pt-[22px] app-desktop:pb-[17px] app-desktop:max-[1380px]:min-w-0" aria-label="Xem trước hồ sơ">
          <h2 className="app-desktop:ml-[7px]">Xem trước hồ sơ</h2>
          {cover}
          <div className="profile-editor-preview-identity app-desktop:flex app-desktop:items-center app-desktop:gap-[15px] app-desktop:pl-5">
            <UserAvatar username={username} name={editName} className="profile-editor-preview-avatar app-desktop:z-[2] app-desktop:mt-[-36px] app-desktop:block app-desktop:h-[82px] app-desktop:w-[82px] app-desktop:shrink-0 app-desktop:rounded-full app-desktop:border-[5px] app-desktop:border-white" />
            <div className="profile-editor-preview-name app-desktop:flex app-desktop:min-w-0 app-desktop:flex-1 app-desktop:flex-col app-desktop:gap-1.5 app-desktop:pt-2.5"><strong className="app-desktop:break-words app-desktop:text-ui-section app-desktop:font-[750] app-desktop:text-[#223451]">{editName}</strong><span className="app-desktop:break-words app-desktop:text-xs app-desktop:text-[#8390aa]">@{editUsername}</span></div>
          </div>
          <div className="profile-editor-preview-about app-desktop:px-[11px] app-desktop:pt-[11px] app-desktop:text-[13px] app-desktop:text-[#58708e]">
            <p className="app-desktop:mb-[9px] app-desktop:leading-[1.6]">{bioDraft.trim() || 'Thêm tiểu sử để mọi người hiểu hơn về bạn.'}</p>
            {cityDraft.trim() && <div className="app-desktop:flex app-desktop:items-center app-desktop:gap-[7px] app-desktop:text-xs app-desktop:text-[#7c8ba8]"><MapPin size={15} aria-hidden="true" /><span>{cityDraft.trim()}</span></div>}
          </div>
          <div className="profile-editor-preview-message app-desktop:mt-[15px] app-desktop:mr-[11px] app-desktop:ml-[11px] app-desktop:flex app-desktop:items-center app-desktop:gap-1.5 app-desktop:text-[11px] app-desktop:text-[#9aa6ba]"><Eye size={15} aria-hidden="true" /> Xem trước thông tin đang chỉnh sửa</div>
        </section>
  )
}