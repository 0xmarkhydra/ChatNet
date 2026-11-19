import { AtSign, Image as ImageIcon, LockKeyhole, MapPin, PencilLine, ShieldCheck, Users, Video } from 'lucide-react'
import type { FriendConnection } from '../../contacts'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { ProfileMediaItem } from './ProfileMediaGallery'

type Props = {
  username: string
  email?: string
  bio?: string
  city?: string
  friends: FriendConnection[]
  media: ProfileMediaItem[]
  onEditProfile: () => void
  onShowMedia: () => void
  onShowFriends: () => void
  onViewFriend: (username: string) => void
  onOpenPost: (postId: number) => void
}

export default function ProfileSidebar({ username, email, bio, city, friends, media, onEditProfile, onShowMedia, onShowFriends, onViewFriend, onOpenPost }: Props) {
  return (
        <aside className="profile-page-aside" aria-label="Thông tin, ảnh và bạn bè">
          <section className="profile-page-about">
            <h2>Giới thiệu</h2>
            {bio && <p className="profile-page-about-description">{bio}</p>}
            <button type="button" className="profile-page-aside-action" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa thông tin</button>
            {city && <div className="profile-page-about-row"><MapPin size={20} aria-hidden="true" /><span>Sống tại <strong>{city}</strong></span></div>}
            <div className="profile-page-about-row"><AtSign size={20} aria-hidden="true" /><span>Tài khoản <strong>@{username}</strong></span></div>
            <div className="profile-page-about-row"><Users size={20} aria-hidden="true" /><span>Có <strong>{friends.length.toLocaleString('vi-VN')}</strong> bạn bè</span></div>
            {email && <div className="profile-page-about-row"><LockKeyhole size={20} aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
          </section>
          <section className="profile-page-recent">
            <div className="profile-page-recent-heading"><h2>Ảnh</h2>
              <button type="button" onClick={onShowMedia}>Xem tất cả ảnh</button>
            </div>
            {media.length > 0
              ? <div className="profile-page-recent-grid">
                {media.slice(0, 9).map(({ postId, attachment, index }) =>
                  <button type="button" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`} onClick={() => onOpenPost(postId)} aria-label="Mở bài viết chứa ảnh gần đây">
                    {attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name || 'Ảnh gần đây'} loading="lazy" /> :
                      <><video src={attachment.url} muted preload="metadata" playsInline /><Video size={19} aria-hidden="true" /></>}
                  </button>)}
              </div>
              : <div className="profile-page-recent-empty"><ImageIcon size={24} aria-hidden="true" /><span>Chưa có ảnh trong bài viết đã tải</span></div>}
          </section>
          {friends.length > 0 && (
            <section className="profile-page-recent profile-page-friends-card">
              <div className="profile-page-recent-heading"><h2>Bạn bè</h2>
                <button type="button" onClick={onShowFriends}>Xem tất cả bạn bè</button>
              </div>
              <p className="profile-page-friends-count">{friends.length.toLocaleString('vi-VN')} bạn bè</p>
              <div className="profile-page-friend-tiles">
                {friends.slice(0, 9).map(friend => {
                  const label = friend.displayName || friend.username
                  return (
                    <button type="button" key={friend.id} onClick={() => onViewFriend(friend.username)} title={`Xem hồ sơ ${label}`}>
                      <UserAvatar username={friend.username} name={label} className="profile-page-tile-avatar" />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          <div className="profile-page-privacy-note"><ShieldCheck size={18} aria-hidden="true" /><span>Thông tin hiển thị tuân theo cài đặt quyền riêng tư của tài khoản.</span></div>
        </aside>
  )
}
