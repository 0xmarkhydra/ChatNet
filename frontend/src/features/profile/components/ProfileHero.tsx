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
}

export default function ProfileHero({ displayName, username, city, workplace, school, friendCount, coverUrl, fallbackCoverTone, coverAction, avatar, actions, identityNotice, compact = false, centered = false }: Props) {
  const [failedCover, setFailedCover] = useState<string>()
  const showCover = coverUrl && coverUrl !== failedCover
  const coverClass = showCover ? 'has-user-cover' : fallbackCoverTone === undefined ? 'has-default-cover' : `has-account-cover avatar-tone-${fallbackCoverTone}`
  const details = [
    { id: 'city', text: city?.trim(), label: 'Nơi sống', Icon: MapPin },
    { id: 'workplace', text: workplace?.trim(), label: 'Nơi làm việc', Icon: BriefcaseBusiness },
    { id: 'school', text: school?.trim(), label: 'Trường học', Icon: GraduationCap },
  ].filter(detail => detail.text)
  return (
    <section className={'profile-page-hero' + (compact ? ' profile-page-hero-compact' : centered ? ' profile-page-hero-centered' : '')}>
      <div className={`profile-page-cover ${coverClass}`}>
        {showCover && <img src={coverUrl} alt="Ảnh bìa" draggable={false} onError={() => setFailedCover(coverUrl)} />}
        {coverAction}
      </div>
      <div className="profile-page-hero-bottom">
        <div className="profile-page-avatar-wrap">{avatar}</div>
        <div className="profile-page-identity-text">
          <h1>{displayName}</h1>
          <div className="profile-page-identity-summary">
            <div className="profile-page-identity-meta">@{username}</div>
            {friendCount !== undefined && friendCount > 0 &&
              <p className="profile-page-friend-summary">{friendCount.toLocaleString('vi-VN')} người bạn</p>}
          </div>
          {details.length > 0 && <ul role="list" className="profile-page-identity-details mt-[5px] flex list-none flex-wrap gap-x-3 gap-y-[5px] p-0 text-sm leading-[1.45] text-[var(--soco-muted)]">
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