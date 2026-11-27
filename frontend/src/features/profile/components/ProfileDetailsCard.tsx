import { AtSign, BriefcaseBusiness, GraduationCap, LockKeyhole, MapPin, PencilLine, Users } from 'lucide-react'

const detailRowClasses = 'profile-page-about-row flex min-h-10 items-center gap-3 text-[15px] text-foreground [&>svg]:shrink-0 [&>svg]:text-[#8191ad]'

type Props = {
  username: string
  bio?: string
  city?: string
  workplace?: string
  school?: string
  iconEdit?: boolean
  grouped?: boolean
  friendCount?: number
  hasPrivateEmail?: boolean
  onEdit?: () => void
}

export default function ProfileDetailsCard({ username, bio, city, workplace, school, iconEdit, grouped, friendCount, hasPrivateEmail, onEdit }: Props) {
  if (grouped) {
    const groups = [
      { title: "Công việc", value: workplace, Icon: BriefcaseBusiness },
      { title: "Giáo dục", value: school, Icon: GraduationCap },
    ];
    const edit = (label: string) => onEdit && <button type="button" aria-label={label} onClick={onEdit} className="grid size-control-touch shrink-0 place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><PencilLine size={20} aria-hidden="true" /></button>;
    return (
      <section className="profile-page-about grid gap-ui-3 rounded-ui-lg border border-solid border-border-subtle bg-card p-ui-4 text-sm leading-relaxed font-medium text-foreground shadow-sm">
        <div className="grid gap-ui-1.5">
          <header className="flex items-center justify-between gap-ui-2"><h2 className="m-0 text-base! font-semibold! text-foreground!">Thông tin cá nhân</h2>{edit("Chỉnh sửa thông tin")}</header>
          {bio && <p className="m-0 wrap-anywhere text-sm! font-normal!">{bio}</p>}
          {city && <div className="flex items-center gap-ui-3 py-ui-1"><MapPin size={22} className="shrink-0" aria-hidden="true" /><span>Sống tại <strong className="font-semibold">{city}</strong></span></div>}
          <div className="flex items-center gap-ui-3 py-ui-1"><AtSign size={22} className="shrink-0" aria-hidden="true" /><span>@{username}</span></div>
          {friendCount !== undefined && <div className="flex items-center gap-ui-3 py-ui-1"><Users size={22} className="shrink-0" aria-hidden="true" /><span>{friendCount.toLocaleString("vi-VN")} bạn bè</span></div>}
          {hasPrivateEmail && <div className="flex items-center gap-ui-3 py-ui-1"><LockKeyhole size={20} className="shrink-0" aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
        </div>
        {groups.map(({ title, value, Icon }) => (
          <div key={title} className="grid gap-ui-1.5">
            <header className="flex items-center justify-between gap-ui-2"><h2 className="m-0 text-base! font-semibold! text-foreground!">{title}</h2>{edit("Chỉnh sửa " + title.toLowerCase())}</header>
            {value?.trim() ? <div className="flex min-w-0 items-center gap-ui-3 py-ui-1"><span className="grid size-control-touch shrink-0 place-items-center rounded-full bg-secondary"><Icon size={23} aria-hidden="true" /></span><span className="min-w-0 wrap-anywhere text-sm! font-medium!">{value}</span></div> : <p className="m-0 text-sm font-medium text-muted-foreground">Chưa cập nhật</p>}
          </div>
        ))}
      </section>
    );
  }
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