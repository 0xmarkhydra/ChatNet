import { ArrowRight, AtSign, Image as ImageIcon, LockKeyhole, MapPin, PencilLine, ShieldCheck, Users, Video } from 'lucide-react'
import type { ProfileMediaItem } from './ProfileMediaGallery'

type Props = {
  username: string
  email?: string
  bio?: string
  city?: string
  acceptedFriendCount: number
  media: ProfileMediaItem[]
  onEditProfile: () => void
  onShowMedia: () => void
  onOpenPost: (postId: number) => void
}

export default function ProfileSidebar({ username, email, bio, city, acceptedFriendCount, media, onEditProfile, onShowMedia, onOpenPost }: Props) {
  return (
        <aside className="profile-page-aside" aria-label="Thông tin và ảnh cá nhân">
          <section className="profile-page-about">
            <h2>Giới thiệu</h2>
            <p className="profile-page-about-description">{bio || 'Thông tin hồ sơ và kết nối của bạn trên SocCo.'}</p>
            {city && <div className="profile-page-about-row"><MapPin size={19} aria-hidden="true" /><span>{city}</span></div>}
            <div className="profile-page-about-row"><AtSign size={19} aria-hidden="true" /><span>Tài khoản @{username}</span></div>
            <div className="profile-page-about-row"><Users size={19} aria-hidden="true" /><span>{acceptedFriendCount.toLocaleString('vi-VN')} bạn bè</span></div>
            {email && <div className="profile-page-about-row"><LockKeyhole size={19} aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
            <button type="button" className="profile-page-aside-action" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa thông tin</button>
          </section>
          <section className="profile-page-recent">
            <div className="profile-page-recent-heading"><h2>Ảnh gần đây</h2>
              <button type="button" onClick={onShowMedia}>Xem tất cả <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
            {media.length > 0
              ? <div className="profile-page-recent-grid">
                {media.slice(0, 3).map(({ postId, attachment, index }) =>
                  <button type="button" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`} onClick={() => onOpenPost(postId)} aria-label="Mở bài viết chứa ảnh gần đây">
                    {attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name || 'Ảnh gần đây'} loading="lazy" /> :
                      <><video src={attachment.url} muted preload="metadata" playsInline /><Video size={19} aria-hidden="true" /></>}
                  </button>)}
              </div>
              : <div className="profile-page-recent-empty"><ImageIcon size={24} aria-hidden="true" /><span>Chưa có ảnh trong bài viết đã tải</span></div>}
          </section>
          <div className="profile-page-privacy-note"><ShieldCheck size={18} aria-hidden="true" /><span>Thông tin hiển thị tuân theo cài đặt quyền riêng tư của tài khoản.</span></div>
        </aside>
  )
}
