import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Image as ImageIcon, Video } from 'lucide-react'
import type { FriendConnection } from '../../contacts'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { ProfileMediaItem } from './ProfileMediaGallery'
import ProfileDetailsCard from './ProfileDetailsCard'

type Props = {
  username: string
  email?: string
  bio?: string
  city?: string
  friends: FriendConnection[]
  media: ProfileMediaItem[]
  highlights?: ReactNode
  onEditProfile: () => void
  onShowMedia: () => void
  onShowFriends: () => void
  onViewFriend: (username: string) => void
  onOpenPost: (postId: number) => void
}

export default function ProfileSidebar({ username, email, bio, city, friends, media, highlights, onEditProfile, onShowMedia, onShowFriends, onViewFriend, onOpenPost }: Props) {
  const trUi = useUiTranslation()

  const aside = useRef<HTMLElement>(null)
  const [stickyTop, setStickyTop] = useState(16)
  useEffect(() => {
    const element = aside.current
    const viewport = element?.closest<HTMLElement>('.profile-page')
    if (!element || !viewport || typeof ResizeObserver === 'undefined') return
    const measure = () => setStickyTop(Math.min(16, viewport.clientHeight - element.getBoundingClientRect().height - 16))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
  return (
        <aside ref={aside} className="profile-page-aside" style={{ '--profile-aside-top': `${stickyTop}px` } as CSSProperties} aria-label={trUi("common.ui.profileInfoPhotosFriends")}>
          <ProfileDetailsCard username={username} bio={bio} city={city} friendCount={friends.length}
            hasPrivateEmail={Boolean(email)} onEdit={onEditProfile} />
          {highlights}
          <section className="profile-page-recent">
            <div className="profile-page-recent-heading"><h2>{trUi("common.photos")}</h2>
              <button type="button" onClick={onShowMedia}>Xem tất cả ảnh</button>
            </div>
            {media.length > 0
              ? <div className="profile-page-recent-grid">
                {media.slice(0, 9).map(({ postId, attachment, index }) =>
                  <button type="button" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`} onClick={() => onOpenPost(postId)} aria-label={trUi("common.ui.openRecentPhotoPost")}>
                    {attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name || trUi("common.ui.recentPhotos")} loading="lazy" /> :
                      <><video src={attachment.url} muted preload="metadata" playsInline /><Video size={19} aria-hidden="true" /></>}
                  </button>)}
              </div>
              : <div className="profile-page-recent-empty"><ImageIcon size={24} aria-hidden="true" /><span>Chưa có ảnh trong bài viết đã tải</span></div>}
          </section>
          {friends.length > 0 && (
            <section className="profile-page-recent profile-page-friends-card">
              <div className="profile-page-recent-heading"><h2>{trUi("contacts.friends")}</h2>
                <button type="button" onClick={onShowFriends}>Xem tất cả bạn bè</button>
              </div>
              <p className="profile-page-friends-count">{friends.length.toLocaleString('vi-VN')} bạn bè</p>
              <div className="profile-page-friend-tiles">
                {friends.slice(0, 9).map(friend => {
                  const label = friend.displayName || friend.username
                  return (
                    <button type="button" key={friend.id} onClick={() => onViewFriend(friend.username)} title={trUi("common.ui.viewProfileNamed", { v1: String(label) })}>
                      <UserAvatar username={friend.username} name={label} className="profile-page-tile-avatar" />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </aside>
  )
}