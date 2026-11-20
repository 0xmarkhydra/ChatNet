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
  coverAction?: ReactNode
  avatar: ReactNode
  actions?: ReactNode
  identityNotice?: ReactNode
}

export default function ProfileHero({ displayName, username, city, workplace, school, friendCount, coverUrl, coverAction, avatar, actions, identityNotice }: Props) {
  const [failedCover, setFailedCover] = useState<string>()
  const showCover = coverUrl && coverUrl !== failedCover
  const details = [
    { id: 'city', text: city?.trim(), label: 'Nơi sống', Icon: MapPin },
    { id: 'workplace', text: workplace?.trim(), label: 'Nơi làm việc', Icon: BriefcaseBusiness },
    { id: 'school', text: school?.trim(), label: 'Trường học', Icon: GraduationCap },
  ].filter(detail => detail.text)
  return (
    <section className="profile-page-hero">
      <div className={`profile-page-cover ${showCover ? 'has-user-cover' : 'has-default-cover'}`}>
        {showCover && <img src={coverUrl} alt="Ảnh bìa" draggable={false} onError={() => setFailedCover(coverUrl)} />}
        {coverAction}
      </div>
      <div className="profile-page-hero-bottom">
        <div className="profile-page-avatar-wrap">{avatar}</div>
        <div className="profile-page-identity-text">
          <h1>{displayName}</h1>
          <div className="profile-page-identity-meta">@{username}</div>
          {friendCount !== undefined && friendCount > 0 &&
            <p className="profile-page-friend-summary">{friendCount.toLocaleString('vi-VN')} người bạn</p>}
          {details.length > 0 && <ul role="list" className="profile-page-identity-details">
            {details.map(({ id, text, label, Icon }) => <li key={id}>
              <Icon size={15} aria-hidden="true" />
              <span><span className="sr-only">{label}: </span>{text}</span>
            </li>)}
          </ul>}
          {identityNotice}
        </div>
        {actions && <div className="profile-page-hero-actions">{actions}</div>}
      </div>
    </section>
  )
}