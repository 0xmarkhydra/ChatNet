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
        <section className="profile-editor-preview-card min-[761px]:h-[428px] min-[761px]:px-4 min-[761px]:pt-[22px] min-[761px]:pb-[17px] min-[761px]:max-[1380px]:min-w-0" aria-label="Xem trước hồ sơ">
          <h2 className="min-[761px]:ml-[7px]">Xem trước hồ sơ</h2>
          {cover}
          <div className="profile-editor-preview-identity min-[761px]:flex min-[761px]:items-center min-[761px]:gap-[15px] min-[761px]:pl-5">
            <UserAvatar username={username} name={editName} className="profile-editor-preview-avatar min-[761px]:z-[2] min-[761px]:mt-[-36px] min-[761px]:block min-[761px]:h-[82px] min-[761px]:w-[82px] min-[761px]:shrink-0 min-[761px]:rounded-full min-[761px]:border-[5px] min-[761px]:border-white" />
            <div className="profile-editor-preview-name min-[761px]:flex min-[761px]:min-w-0 min-[761px]:flex-1 min-[761px]:flex-col min-[761px]:gap-1.5 min-[761px]:pt-2.5"><strong className="min-[761px]:break-words min-[761px]:text-ui-section min-[761px]:font-[750] min-[761px]:text-[#223451]">{editName}</strong><span className="min-[761px]:break-words min-[761px]:text-xs min-[761px]:text-[#8390aa]">@{editUsername}</span></div>
          </div>
          <div className="profile-editor-preview-about min-[761px]:px-[11px] min-[761px]:pt-[11px] min-[761px]:text-[13px] min-[761px]:text-[#58708e]">
            <p className="min-[761px]:mb-[9px] min-[761px]:leading-[1.6]">{bioDraft.trim() || 'Thêm tiểu sử để mọi người hiểu hơn về bạn.'}</p>
            {cityDraft.trim() && <div className="min-[761px]:flex min-[761px]:items-center min-[761px]:gap-[7px] min-[761px]:text-xs min-[761px]:text-[#7c8ba8]"><MapPin size={15} aria-hidden="true" /><span>{cityDraft.trim()}</span></div>}
          </div>
          <div className="profile-editor-preview-message min-[761px]:mt-[15px] min-[761px]:mr-[11px] min-[761px]:ml-[11px] min-[761px]:flex min-[761px]:items-center min-[761px]:gap-1.5 min-[761px]:text-[11px] min-[761px]:text-[#9aa6ba]"><Eye size={15} aria-hidden="true" /> Xem trước thông tin đang chỉnh sửa</div>
        </section>
  )
}