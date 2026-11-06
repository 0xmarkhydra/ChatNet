import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, AtSign, MapPin, Camera, Image as ImageIcon, LockKeyhole, Mail, PencilLine, Plus, RefreshCw, ShieldCheck, Users, UserRound, Video } from 'lucide-react'
import type { Post } from '../features/feed/types'
import type { FriendConnection } from '../features/contacts/types'
import type { MediaAttachment } from '../shared/lib/media'
import UserAvatar from '../shared/ui/UserAvatar'

type Section = 'posts' | 'media' | 'about' | 'friends'
type MediaItem = { postId: number; attachment: MediaAttachment; index: number }

type Props = {
  username: string
  displayName: string
  email?: string
  bio?: string
  city?: string
  coverUrl?: string
  coverSet: boolean
  editBusy: boolean
  friends: FriendConnection[]
  posts: Post[]
  pendingPost: Post | null
  postsBusy: boolean
  postsError: string
  hasMorePosts: boolean
  postCards: ReactNode
  profileNote: ReactNode
  onEditProfile: () => void
  onChangeAvatar: () => void
  onChangeCover: () => void
  onCreatePost: () => void
  onReloadPosts: () => void
  onLoadMorePosts: () => void
  onViewFriend: (username: string) => void
  onOpenContacts: () => void
  onOpenPost: (postId: number) => void
}

export default function DesktopProfilePage({
  username, displayName, email, bio, city, coverUrl, coverSet, editBusy, friends,
  posts, pendingPost, postsBusy, postsError, hasMorePosts, postCards, profileNote,
  onEditProfile, onChangeAvatar, onChangeCover, onCreatePost,
  onReloadPosts, onLoadMorePosts, onViewFriend, onOpenContacts, onOpenPost,
}: Props) {
  const [section, setSection] = useState<Section>('posts')
  const acceptedFriends = useMemo(() => friends.filter(friend => friend.status === 'accepted'), [friends])
  const media = useMemo<MediaItem[]>(() => posts.flatMap(post => (post.attachments || [])
    .filter(item => (item.kind === 'image' || item.kind === 'video') && item.url)
    .map((attachment, index) => ({ postId: post.id, attachment, index }))), [posts])
  const tabs: { id: Section; name: string }[] = [
    { id: 'posts', name: 'Bài viết' },
    { id: 'media', name: 'Ảnh & video' },
    { id: 'about', name: 'Giới thiệu' },
    { id: 'friends', name: 'Bạn bè' },
  ]

  const gallery = (items: MediaItem[], emptyText: string) => items.length ? (
    <div className="social-profile-media-grid">
      {items.map(({ postId, attachment, index }) => (
        <button className="social-profile-media-item" type="button" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`}
          onClick={() => onOpenPost(postId)} aria-label={`Xem bài viết chứa ${attachment.name || 'ảnh hoặc video'}`}>
          {attachment.kind === 'image'
            ? <img src={attachment.url} alt={attachment.name || 'Ảnh bài viết'} loading="lazy" />
            : <><video src={attachment.url} preload="metadata" muted playsInline aria-label={attachment.name || 'Video bài viết'} /><Video size={23} className="social-profile-video-badge" aria-hidden="true" /></>}
        </button>
      ))}
    </div>
  ) : (
    <div className="social-profile-blank"><ImageIcon size={30} aria-hidden="true" />
      <p>{postsBusy ? 'Đang tải ảnh và video...' : emptyText}</p>
      <button type="button" onClick={onCreatePost}>Chia sẻ khoảnh khắc</button>
    </div>
  )

  return (
    <div className="social-profile-page" aria-label="Trang cá nhân">
      <section className="social-profile-hero">
        <div className={`social-profile-cover ${coverSet && coverUrl ? 'has-user-cover' : 'has-default-cover'}`}>
          {coverSet && coverUrl && <img src={coverUrl} alt="Ảnh bìa hồ sơ của bạn" draggable={false}
            onError={event => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.remove('has-user-cover') }} />}
          <button type="button" className="social-profile-cover-action" onClick={onChangeCover}
            disabled={editBusy} title="Thay đổi ảnh bìa"><Camera size={17} aria-hidden="true" /><span>{coverSet ? 'Đổi ảnh bìa' : 'Thêm ảnh bìa'}</span></button>
        </div>
        <div className="social-profile-avatar-wrap">
          {profileNote}
          <UserAvatar username={username} name={displayName} className="social-profile-avatar" online />
          <button type="button" className="social-profile-avatar-action" disabled={editBusy}
            onClick={onChangeAvatar} aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện"><Camera size={17} aria-hidden="true" /></button>
        </div>
        <div className="social-profile-hero-bottom">
          <div className="social-profile-identity-text">
            <h1>{displayName}</h1>
            <div className="social-profile-identity-meta">
              <span>@{username}</span>
              <span>{acceptedFriends.length.toLocaleString('vi-VN')} bạn bè</span>
              <span>{posts.length.toLocaleString('vi-VN')}{hasMorePosts ? '+' : ''} bài viết đã tải</span>
              <span>{media.length.toLocaleString('vi-VN')} ảnh/video đã tải</span>
            </div>
          </div>
          <div className="social-profile-hero-actions">
            <button type="button" className="social-profile-primary" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" /> Chỉnh sửa hồ sơ</button>
            <button type="button" className="social-profile-more" onClick={onCreatePost} aria-label="Đăng bài mới" title="Đăng bài mới"><Plus size={21} aria-hidden="true" /></button>
          </div>
        </div>
      </section>

      <div className="social-profile-columns">
        <section className="social-profile-main" aria-label="Nội dung trang cá nhân">
          <div className="social-profile-tabbar" role="tablist" aria-label="Chọn nội dung hồ sơ">
            {tabs.map(tab => (
              <button key={tab.id} type="button" role="tab" id={`social-profile-tab-${tab.id}`}
                aria-selected={section === tab.id} aria-controls="social-profile-tab-content"
                className={section === tab.id ? 'is-active' : ''} onClick={() => setSection(tab.id)}>{tab.name}</button>
            ))}
            <button type="button" className="social-profile-post-action" onClick={section === 'posts' ? onCreatePost : onReloadPosts}
              disabled={section !== 'posts' && postsBusy} aria-label={section === 'posts' ? 'Đăng bài viết mới' : 'Làm mới nội dung'}>
              {section === 'posts' ? <><Plus size={16} /> Đăng bài</> : <RefreshCw size={17} />}
            </button>
          </div>

          <div id="social-profile-tab-content" role="tabpanel" aria-labelledby={`social-profile-tab-${section}`} className="social-profile-panel">
            {section === 'posts' && (
              <>
                {pendingPost && <div className="social-profile-pending"><strong>Đang đăng bài viết...</strong><p>{pendingPost.content}</p></div>}
                {postsError && <div className="social-profile-error" role="alert">{postsError}
                  <button type="button" onClick={onReloadPosts}>Thử lại</button></div>}
                {postsBusy && posts.length === 0 && <p role="status" className="social-profile-hint">Đang tải bài viết...</p>}
                <div className="social-profile-post-feed feed zalo-feed">{postCards}</div>
                {!postsBusy && !postsError && posts.length === 0 && !pendingPost &&
                  <div className="social-profile-blank"><ImageIcon size={30} aria-hidden="true" /><p>Bạn chưa có bài viết nào.</p>
                    <button type="button" onClick={onCreatePost}>Đăng bài đầu tiên</button></div>}
                {hasMorePosts && <button className="social-profile-more-posts" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>
                  {postsBusy ? 'Đang tải...' : 'Xem bài viết cũ hơn'} <ArrowRight size={16} aria-hidden="true" /></button>}
              </>
            )}
            {section === 'media' && (
              <div className="social-profile-subsection">
                <h2>Ảnh & video</h2>
                <p>Ảnh và video từ các bài viết đã tải của bạn.</p>
                {gallery(media, 'Chưa có ảnh hoặc video trong các bài viết đã tải.')}
                {hasMorePosts && <button className="social-profile-more-posts" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>Tải thêm bài viết để xem ảnh cũ hơn</button>}
              </div>
            )}
            {section === 'about' && (
              <div className="social-profile-subsection">
                <h2>Giới thiệu</h2>
                <p>Thông tin tài khoản của bạn trên SocCo.</p>
                <div className="social-profile-info-line"><UserRound size={19} aria-hidden="true" /><span>Tên hiển thị</span><strong>{displayName}</strong></div>
                <div className="social-profile-info-line"><Users size={19} aria-hidden="true" /><span>Tên người dùng</span><strong>@{username}</strong></div>
                {bio && <div className="social-profile-info-line"><UserRound size={19} aria-hidden="true" /><span>Tiểu sử</span><strong>{bio}</strong></div>}
                {city && <div className="social-profile-info-line"><MapPin size={19} aria-hidden="true" /><span>Thành phố</span><strong>{city}</strong></div>}
                {email && <div className="social-profile-info-line"><Mail size={19} aria-hidden="true" /><span>Email (chỉ bạn xem)</span><strong>{email}</strong></div>}
                <button type="button" className="social-profile-info-edit" onClick={onEditProfile}><PencilLine size={17} /> Chỉnh sửa thông tin</button>
              </div>
            )}
            {section === 'friends' && (
              <div className="social-profile-subsection">
                <h2>Bạn bè của bạn</h2>
                <p>{acceptedFriends.length.toLocaleString('vi-VN')} liên hệ đã kết bạn.</p>
                <div className="social-profile-friends">
                  {acceptedFriends.slice(0, 12).map(friend => (
                    <button type="button" key={friend.id} className="social-profile-friend"
                      onClick={() => onViewFriend(friend.username)} title={`Xem hồ sơ ${friend.displayName || friend.username}`}>
                      <UserAvatar username={friend.username} name={friend.displayName || friend.username} className="social-profile-friend-avatar" online={friend.online} />
                      <span><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}</small></span><ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {acceptedFriends.length === 0 && <p className="social-profile-hint">Chưa có bạn bè trong danh bạ.</p>}
                <button type="button" className="social-profile-info-edit" onClick={onOpenContacts}>Mở danh bạ <ArrowRight size={16} /></button>
              </div>
            )}
          </div>
        </section>

        <aside className="social-profile-aside" aria-label="Thông tin và ảnh cá nhân">
          <section className="social-profile-about">
            <h2>Giới thiệu</h2>
            <p className="social-profile-about-description">{bio || 'Thông tin hồ sơ và kết nối của bạn trên SocCo.'}</p>
            {city && <div className="social-profile-about-row"><MapPin size={19} aria-hidden="true" /><span>{city}</span></div>}
            <div className="social-profile-about-row"><AtSign size={19} aria-hidden="true" /><span>Tài khoản @{username}</span></div>
            <div className="social-profile-about-row"><Users size={19} aria-hidden="true" /><span>{acceptedFriends.length.toLocaleString('vi-VN')} bạn bè</span></div>
            {email && <div className="social-profile-about-row"><LockKeyhole size={19} aria-hidden="true" /><span>Email chỉ hiển thị với bạn</span></div>}
            <button type="button" className="social-profile-aside-action" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa thông tin</button>
          </section>
          <section className="social-profile-recent">
            <div className="social-profile-recent-heading"><h2>Ảnh gần đây</h2>
              <button type="button" onClick={() => setSection('media')}>Xem tất cả <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
            {media.length > 0
              ? <div className="social-profile-recent-grid">
                {media.slice(0, 3).map(({ postId, attachment, index }) =>
                  <button type="button" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`} onClick={() => onOpenPost(postId)} aria-label="Mở bài viết chứa ảnh gần đây">
                    {attachment.kind === 'image' ? <img src={attachment.url} alt={attachment.name || 'Ảnh gần đây'} loading="lazy" /> :
                      <><video src={attachment.url} muted preload="metadata" playsInline /><Video size={19} aria-hidden="true" /></>}
                  </button>)}
              </div>
              : <div className="social-profile-recent-empty"><ImageIcon size={24} aria-hidden="true" /><span>Chưa có ảnh trong bài viết đã tải</span></div>}
          </section>
          <div className="social-profile-privacy-note"><ShieldCheck size={18} aria-hidden="true" /><span>Thông tin hiển thị tuân theo cài đặt quyền riêng tư của tài khoản.</span></div>
        </aside>
      </div>
    </div>
  )
}