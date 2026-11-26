import { useState, type ReactNode } from 'react'
import { BriefcaseBusiness, GraduationCap, MapPin } from 'lucide-react'

type Props = {
  displayName: string
  username: string
  city?: string
  workplace?: string
  school?: string
  friendCount?: number
  coverUrl?: string
  fallbackCoverTone?: number
  coverAction?: ReactNode
  avatar: ReactNode
  actions?: ReactNode
  identityNotice?: ReactNode
  compact?: boolean
  centered?: boolean
  bio?: string
  toolbar?: ReactNode
  note?: ReactNode
}

export default function ProfileHero({ displayName, username, city, workplace, school, friendCount, coverUrl, fallbackCoverTone, coverAction, avatar, actions, identityNotice, compact = false, centered = false, bio, toolbar, note }: Props) {
  const [failedCover, setFailedCover] = useState<string>()
  const showCover = coverUrl && coverUrl !== failedCover
  const coverClass = showCover ? 'has-user-cover' : fallbackCoverTone === undefined ? 'has-default-cover' : `has-account-cover avatar-tone-${fallbackCoverTone}`
  const details = [
    { id: 'city', text: city?.trim(), label: 'Nơi sống', Icon: MapPin },
    { id: 'workplace', text: workplace?.trim(), label: 'Nơi làm việc', Icon: BriefcaseBusiness },
    { id: 'school', text: school?.trim(), label: 'Trường học', Icon: GraduationCap },
  ].filter(detail => detail.text)
  if (centered) {
    return (
      <section className="profile-mobile-full-hero relative mx-auto w-full min-w-0 shrink-0 bg-card">
        <div className={`relative h-[250px] w-full overflow-hidden bg-[image:var(--soco-avatar-gradient)] ${coverClass}`}>
          {showCover && <img className="block size-full object-cover" src={coverUrl} alt="Ảnh bìa" draggable={false} onError={() => setFailedCover(coverUrl)} />}
          {toolbar}
          <div className="absolute inset-x-0 top-28 z-10">{note}</div>
          {coverAction}
        </div>
        <div className="relative -mt-7 grid min-w-0 justify-items-center gap-ui-2 rounded-t-[28px] bg-card px-ui-4 pb-ui-3 text-center">
          <div className="relative -mt-22 box-border size-[180px] rounded-full bg-card p-[5px]" data-profile-avatar-wrap>{avatar}</div>
          <div className="min-w-0 max-w-full wrap-anywhere">
            <h1 className="m-0 text-[26px] leading-tight font-bold tracking-[-0.5px] text-foreground">{displayName}</h1>
            <p className="m-0 mt-ui-1 text-ui-label text-foreground/80">@{username}</p>
            {friendCount !== undefined && friendCount > 0 && <p className="m-0 mt-ui-1 text-ui-label font-bold text-foreground">{friendCount.toLocaleString('vi-VN')} người bạn</p>}
            {bio?.trim() && <p className="m-0 mt-ui-3 text-[15px] leading-relaxed text-foreground">{bio}</p>}
            {identityNotice}
          </div>
          {actions && <div className="mt-ui-2 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-ui-2 max-[340px]:grid-cols-1">{actions}</div>}
        </div>
      </section>
    )
  }
  return (
    <section className={'profile-page-hero' + (compact ? ' profile-page-hero-compact' : '')}>
      <div className={`profile-page-cover ${coverClass}`}>
        {showCover && <img src={coverUrl} alt="Ảnh bìa" draggable={false} onError={() => setFailedCover(coverUrl)} />}
        {coverAction}
      </div>
      <div className="profile-page-hero-bottom">
        <div className="profile-page-avatar-wrap">{note}{avatar}</div>
        <div className="profile-page-identity-text">
          <h1>{displayName}</h1>
          <div className="profile-page-identity-summary">
            <div className="profile-page-identity-meta">@{username}</div>
            {friendCount !== undefined && friendCount > 0 &&
              <p className="profile-page-friend-summary">{friendCount.toLocaleString('vi-VN')} người bạn</p>}
          </div>
          {details.length > 0 && <ul role="list" className="profile-page-identity-details mt-[5px] flex list-none flex-wrap gap-x-3 gap-y-[5px] p-0 text-sm leading-[1.45] text-muted-foreground">
            {details.map(({ id, text, label, Icon }) => <li key={id} className="flex min-w-0 max-w-full items-start gap-[5px]">
              <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words"><span className="sr-only">{label}: </span>{text}</span>
            </li>)}
          </ul>}
          {identityNotice}
        </div>
        {actions && <div className="profile-page-hero-actions">{actions}</div>}
      </div>
    </section>
  )
}