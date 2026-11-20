import { AtSign, LockKeyhole, MapPin, PencilLine, Users } from 'lucide-react'

type Props = {
  username: string
  bio?: string
  city?: string
  friendCount?: number
  hasPrivateEmail?: boolean
  onEdit?: () => void
}

export default function ProfileDetailsCard({ username, bio, city, friendCount, hasPrivateEmail, onEdit }: Props) {
  return (
    <section className="profile-page-about">
      <h2>Thông tin cá nhân</h2>
      {bio && <p className="profile-page-about-description">{bio}</p>}
      {onEdit && <button type="button" className="profile-page-aside-action" onClick={onEdit}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa thông tin</button>}
      {city && <div className="profile-page-about-row"><MapPin size={20} aria-hidden="true" /><span>Sống tại <strong>{city}</strong></span></div>}
      <div className="profile-page-about-row"><AtSign size={20} aria-hidden="true" /><span>Tài khoản <strong>@{username}</strong></span></div>
      {friendCount !== undefined && <div className="profile-page-about-row"><Users size={20} aria-hidden="true" /><span>Có <strong>{friendCount.toLocaleString('vi-VN')}</strong> bạn bè</span></div>}
      {hasPrivateEmail && <div className="profile-page-about-row"><LockKeyhole size={20} aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
    </section>
  )
}
