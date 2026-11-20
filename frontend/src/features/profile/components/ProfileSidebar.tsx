import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
        <aside ref={aside} className="profile-page-aside" style={{ '--profile-aside-top': `${stickyTop}px` } as CSSProperties} aria-label="Thông tin, ảnh và bạn bè">
          <section className="profile-page-about min-[761px]:p-5">
            <h2>Giới thiệu</h2>
            {bio && <p className="profile-page-about-description min-[761px]:mt-3.5 min-[761px]:text-center min-[761px]:text-[15px] min-[761px]:leading-normal min-[761px]:text-[#17233d]">{bio}</p>}
            <button type="button" className="profile-page-aside-action" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa thông tin</button>
            {city && <div className="profile-page-about-row min-[761px]:flex min-[761px]:min-h-10 min-[761px]:items-center min-[761px]:gap-3 min-[761px]:text-[15px] min-[761px]:text-[#17233d] min-[761px]:[&_svg]:shrink-0 min-[761px]:[&_svg]:text-[#8191ad]"><MapPin size={20} aria-hidden="true" /><span>Sống tại <strong>{city}</strong></span></div>}
            <div className="profile-page-about-row min-[761px]:flex min-[761px]:min-h-10 min-[761px]:items-center min-[761px]:gap-3 min-[761px]:text-[15px] min-[761px]:text-[#17233d] min-[761px]:[&_svg]:shrink-0 min-[761px]:[&_svg]:text-[#8191ad]"><AtSign size={20} aria-hidden="true" /><span>Tài khoản <strong>@{username}</strong></span></div>
            <div className="profile-page-about-row min-[761px]:flex min-[761px]:min-h-10 min-[761px]:items-center min-[761px]:gap-3 min-[761px]:text-[15px] min-[761px]:text-[#17233d] min-[761px]:[&_svg]:shrink-0 min-[761px]:[&_svg]:text-[#8191ad]"><Users size={20} aria-hidden="true" /><span>Có <strong>{friends.length.toLocaleString('vi-VN')}</strong> bạn bè</span></div>
            {email && <div className="profile-page-about-row min-[761px]:flex min-[761px]:min-h-10 min-[761px]:items-center min-[761px]:gap-3 min-[761px]:text-[15px] min-[761px]:text-[#17233d] min-[761px]:[&_svg]:shrink-0 min-[761px]:[&_svg]:text-[#8191ad]"><LockKeyhole size={20} aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
          </section>
          <section className="profile-page-recent min-[761px]:p-5">
            <div className="profile-page-recent-heading min-[761px]:mb-3.5 min-[761px]:flex min-[761px]:items-center min-[761px]:justify-between min-[761px]:gap-2"><h2>Ảnh</h2>
              <button type="button" className="min-[761px]:inline-flex min-[761px]:shrink-0 min-[761px]:cursor-pointer min-[761px]:items-center min-[761px]:gap-0.5 min-[761px]:border-0 min-[761px]:bg-transparent min-[761px]:py-[3px] min-[761px]:text-[15px] min-[761px]:font-medium min-[761px]:text-[#2563eb]" onClick={onShowMedia}>Xem tất cả ảnh</button>
            </div>
            {media.length > 0
              ? <div className="profile-page-recent-grid min-[761px]:grid min-[761px]:grid-cols-3 min-[761px]:gap-1 min-[761px]:overflow-hidden min-[761px]:rounded-[10px]">
                {media.slice(0, 9).map(({ postId, attachment, index }) =>
                  <button type="button" className="min-[761px]:relative min-[761px]:aspect-square min-[761px]:min-w-0 min-[761px]:cursor-pointer min-[761px]:overflow-hidden min-[761px]:rounded-none min-[761px]:border-0 min-[761px]:bg-[#e8eef9] min-[761px]:p-0" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`} onClick={() => onOpenPost(postId)} aria-label="Mở bài viết chứa ảnh gần đây">
                    {attachment.kind === 'image' ? <img className="min-[761px]:block min-[761px]:h-full min-[761px]:w-full min-[761px]:object-cover" src={attachment.url} alt={attachment.name || 'Ảnh gần đây'} loading="lazy" /> :
                      <><video className="min-[761px]:block min-[761px]:h-full min-[761px]:w-full min-[761px]:object-cover" src={attachment.url} muted preload="metadata" playsInline /><Video size={19} aria-hidden="true" /></>}
                  </button>)}
              </div>
              : <div className="profile-page-recent-empty min-[761px]:flex min-[761px]:min-h-[104px] min-[761px]:flex-col min-[761px]:items-center min-[761px]:justify-center min-[761px]:gap-[9px] min-[761px]:text-center min-[761px]:text-xs min-[761px]:text-[#8391a9]"><ImageIcon size={24} aria-hidden="true" /><span>Chưa có ảnh trong bài viết đã tải</span></div>}
          </section>
          {friends.length > 0 && (
            <section className="profile-page-recent profile-page-friends-card min-[761px]:p-5">
              <div className="profile-page-recent-heading min-[761px]:mb-3.5 min-[761px]:flex min-[761px]:items-center min-[761px]:justify-between min-[761px]:gap-2"><h2>Bạn bè</h2>
                <button type="button" className="min-[761px]:inline-flex min-[761px]:shrink-0 min-[761px]:cursor-pointer min-[761px]:items-center min-[761px]:gap-0.5 min-[761px]:border-0 min-[761px]:bg-transparent min-[761px]:py-[3px] min-[761px]:text-[15px] min-[761px]:font-medium min-[761px]:text-[#2563eb]" onClick={onShowFriends}>Xem tất cả bạn bè</button>
              </div>
              <p className="profile-page-friends-count min-[761px]:-mt-2 min-[761px]:mb-3.5 min-[761px]:text-[15px] min-[761px]:text-[#697894]">{friends.length.toLocaleString('vi-VN')} bạn bè</p>
              <div className="profile-page-friend-tiles min-[761px]:grid min-[761px]:grid-cols-3 min-[761px]:gap-x-2 min-[761px]:gap-y-3">
                {friends.slice(0, 9).map(friend => {
                  const label = friend.displayName || friend.username
                  return (
                    <button type="button" className="min-[761px]:min-w-0 min-[761px]:cursor-pointer min-[761px]:border-0 min-[761px]:bg-transparent min-[761px]:p-0 min-[761px]:text-left" key={friend.id} onClick={() => onViewFriend(friend.username)} title={`Xem hồ sơ ${label}`}>
                      <UserAvatar username={friend.username} name={label} className="profile-page-tile-avatar min-[761px]:aspect-square min-[761px]:!h-auto min-[761px]:!w-full min-[761px]:rounded-[10px] min-[761px]:text-[26px]" />
                      <span className="min-[761px]:mt-1.5 min-[761px]:block min-[761px]:truncate min-[761px]:text-[13px] min-[761px]:font-semibold min-[761px]:text-[#17233d]">{label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          <div className="profile-page-privacy-note min-[761px]:flex min-[761px]:items-center min-[761px]:gap-2.5 min-[761px]:px-2.5 min-[761px]:py-0.5 min-[761px]:text-[11px] min-[761px]:leading-normal min-[761px]:text-[#8492ad] min-[761px]:[&_svg]:shrink-0"><ShieldCheck size={18} aria-hidden="true" /><span>Thông tin hiển thị tuân theo cài đặt quyền riêng tư của tài khoản.</span></div>
        </aside>
  )
}