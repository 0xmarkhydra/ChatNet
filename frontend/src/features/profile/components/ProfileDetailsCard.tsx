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
  const rowClasses = iconEdit ? "flex min-w-0 items-start gap-ui-3 text-[15px] leading-normal text-foreground [&>svg]:size-6 [&>svg]:shrink-0 [&>span]:min-w-0 [&>span]:wrap-anywhere" : detailRowClasses
  return (
    <section className={iconEdit ? "grid gap-ui-4 bg-card px-ui-1 pb-ui-2" : "profile-page-about"}>
      {iconEdit ? (
        <header className="flex items-center justify-between gap-ui-2">
          <h2 className="m-0 text-ui-section! font-semibold! tracking-[-0.3px] text-foreground!">Xem nhanh</h2>
          {onEdit && <button type="button" className="min-h-control-touch cursor-pointer rounded-ui-sm border-0 bg-transparent px-ui-1 text-[15px]! font-medium! text-primary! focus-visible:outline-2 focus-visible:outline-ring" aria-label="Chỉnh sửa thông tin" onClick={onEdit}>
            Chỉnh sửa
          </button>}
        </header>
      ) : <h2>Thông tin cá nhân</h2>}
      {bio && <p className="profile-page-about-description mt-3.5 text-center text-[15px] leading-normal text-foreground">{bio}</p>}
      {onEdit && !iconEdit && <button type="button" className="profile-page-aside-action" onClick={onEdit}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa thông tin</button>}
      {city && <div className={rowClasses}><MapPin size={20} aria-hidden="true" /><span>Sống tại <strong>{city}</strong></span></div>}
      {workplace && <div className={rowClasses}><BriefcaseBusiness size={20} aria-hidden="true" /><span>Làm việc tại <strong>{workplace}</strong></span></div>}
      {school && <div className={rowClasses}><GraduationCap size={20} aria-hidden="true" /><span>Học tại <strong>{school}</strong></span></div>}
      <div className={rowClasses}><AtSign size={20} aria-hidden="true" /><span>Tài khoản <strong>@{username}</strong></span></div>
      {friendCount !== undefined && <div className={rowClasses}><Users size={20} aria-hidden="true" /><span>Có <strong>{friendCount.toLocaleString('vi-VN')}</strong> bạn bè</span></div>}
      {hasPrivateEmail && <div className={rowClasses}><LockKeyhole size={20} aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
    </section>
  )
}