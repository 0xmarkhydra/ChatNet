import { useState, type ReactNode } from 'react'
import { MapPin } from 'lucide-react'

type Props = {
  displayName: string
  username: string
  city?: string
  friendCount?: number
  coverUrl?: string
  coverAction?: ReactNode
  avatar: ReactNode
  actions?: ReactNode
  identityNotice?: ReactNode
}

export default function ProfileHero({ displayName, username, city, friendCount, coverUrl, coverAction, avatar, actions, identityNotice }: Props) {
  const [failedCover, setFailedCover] = useState<string>()
  const showCover = coverUrl && coverUrl !== failedCover
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
          <div className="profile-page-identity-meta">
            <span>@{username}</span>
            {friendCount !== undefined && <span>{friendCount.toLocaleString('vi-VN')} bạn bè</span>}
          </div>
          {city && <p className="profile-page-identity-city"><MapPin size={15} aria-hidden="true" />Sống tại {city}</p>}
          {identityNotice}
        </div>
        {actions && <div className="profile-page-hero-actions">{actions}</div>}
      </div>
    </section>
  )
}
