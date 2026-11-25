import { AtSign, BriefcaseBusiness, GraduationCap, LockKeyhole, MapPin, PencilLine, Users } from 'lucide-react'

const detailRowClasses = 'profile-page-about-row flex min-h-10 items-center gap-3 text-[15px] text-foreground [&>svg]:shrink-0 [&>svg]:text-[#8191ad]'

type Props = {
  username: string
  bio?: string
  city?: string
  workplace?: string
  school?: string
  iconEdit?: boolean
  friendCount?: number
  hasPrivateEmail?: boolean
  onEdit?: () => void
}

export default function ProfileDetailsCard({ username, bio, city, workplace, school, iconEdit, friendCount, hasPrivateEmail, onEdit }: Props) {
  return (
    <section className="profile-page-about">
      {iconEdit && onEdit ? (
        <header className="profile-page-about-heading">
          <h2>Thông tin cá nhân</h2>
          <button type="button" className="profile-page-about-edit-icon" aria-label="Chỉnh sửa thông tin" onClick={onEdit}>
            <PencilLine size={18} aria-hidden="true" />
          </button>
        </header>
      ) : <h2>Thông tin cá nhân</h2>}
      {bio && <p className="profile-page-about-description mt-3.5 text-center text-[15px] leading-normal text-foreground">{bio}</p>}
      {onEdit && !iconEdit && <button type="button" className="profile-page-aside-action" onClick={onEdit}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa thông tin</button>}
      {city && <div className={detailRowClasses}><MapPin size={20} aria-hidden="true" /><span>Sống tại <strong>{city}</strong></span></div>}
      {workplace && <div className={detailRowClasses}><BriefcaseBusiness size={20} aria-hidden="true" /><span>Làm việc tại <strong>{workplace}</strong></span></div>}
      {school && <div className={detailRowClasses}><GraduationCap size={20} aria-hidden="true" /><span>Học tại <strong>{school}</strong></span></div>}
      <div className={detailRowClasses}><AtSign size={20} aria-hidden="true" /><span>Tài khoản <strong>@{username}</strong></span></div>
      {friendCount !== undefined && <div className={detailRowClasses}><Users size={20} aria-hidden="true" /><span>Có <strong>{friendCount.toLocaleString('vi-VN')}</strong> bạn bè</span></div>}
      {hasPrivateEmail && <div className={detailRowClasses}><LockKeyhole size={20} aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
    </section>
  )
}