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
        <section className="profile-editor-preview-card" aria-label="Xem trước hồ sơ">
          <h2>Xem trước hồ sơ</h2>
          {cover}
          <div className="profile-editor-preview-identity">
            <UserAvatar username={username} name={editName} className="profile-editor-preview-avatar" />
            <div className="profile-editor-preview-name"><strong>{editName}</strong><span>@{editUsername}</span></div>
          </div>
          <div className="profile-editor-preview-about">
            <p>{bioDraft.trim() || 'Thêm tiểu sử để mọi người hiểu hơn về bạn.'}</p>
            {cityDraft.trim() && <div><MapPin size={15} aria-hidden="true" /><span>{cityDraft.trim()}</span></div>}
          </div>
          <div className="profile-editor-preview-message"><Eye size={15} aria-hidden="true" /> Xem trước thông tin đang chỉnh sửa</div>
        </section>
  )
}
