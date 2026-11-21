import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, MapPin, Camera, ChevronDown, Image as ImageIcon, Mail, PencilLine, Plus, RefreshCw, Users, UserRound } from 'lucide-react'
import type { Post } from '../../feed'
import type { FriendConnection } from '../../contacts'
import ProfileMediaGallery, { type ProfileMediaItem } from './ProfileMediaGallery'
import ProfileSidebar from './ProfileSidebar'
import UserAvatar from '../../../shared/ui/UserAvatar'
import PostStatusPrompt from '../../../shared/ui/PostStatusPrompt'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import ProfileAvatarMenu from './ProfileAvatarMenu'
import ProfileHero from './ProfileHero'
import ProfileTabs from './ProfileTabs'

type Section = 'posts' | 'media' | 'about' | 'friends'

type Props = {
  highlights?: ReactNode
  username: string
  displayName: string
  email?: string
  bio?: string
  city?: string
  workplace?: string
  school?: string
  coverUrl?: string
  coverSet: boolean
  avatarSet: boolean
  avatarVersion?: string
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
  onChangeAvatar: (opener: HTMLButtonElement | null) => void
  onChangeCover: () => void
  onCreatePost: () => void
  onCreateStory: () => void
  onReloadPosts: () => void
  onLoadMorePosts: () => void
  onViewFriend: (username: string) => void
  onOpenContacts: () => void
  onOpenPost: (postId: number) => void
}

export default function ProfilePage({
  highlights, username, displayName, email, bio, city, workplace, school, coverUrl, coverSet, avatarSet, avatarVersion, editBusy, friends,
  posts, pendingPost, postsBusy, postsError, hasMorePosts, postCards, profileNote,
  onEditProfile, onChangeAvatar, onChangeCover, onCreatePost, onCreateStory,
  onReloadPosts, onLoadMorePosts, onViewFriend, onOpenContacts, onOpenPost,
}: Props) {
  const [section, setSection] = useState<Section>('posts')
  const acceptedFriends = useMemo(() => friends.filter(friend => friend.status === 'accepted'), [friends])
  const media = useMemo<ProfileMediaItem[]>(() => posts.flatMap(post => (post.attachments || [])
    .filter(item => (item.kind === 'image' || item.kind === 'video') && item.url)
    .map((attachment, index) => ({ postId: post.id, attachment, index }))), [posts])
  const tabs: { id: Section; label: string }[] = [
    { id: 'posts', label: 'Bài viết' },
    { id: 'media', label: 'Ảnh & video' },
    { id: 'about', label: 'Giới thiệu' },
    { id: 'friends', label: 'Bạn bè' },
  ]


  return (
    <div className="profile-page" aria-label="Trang cá nhân">
      <ProfileHero displayName={displayName} username={username} city={city} workplace={workplace} school={school} friendCount={acceptedFriends.length}
        coverUrl={coverSet ? coverUrl : undefined}
        coverAction={<button type="button" className="profile-page-cover-action" onClick={onChangeCover}
          disabled={editBusy} title="Thay đổi ảnh bìa"><Camera size={17} aria-hidden="true" /><span>{coverSet ? 'Đổi ảnh bìa' : 'Thêm ảnh bìa'}</span></button>}
        avatar={<>
          {profileNote}
          <ProfileAvatarMenu username={username} displayName={displayName} avatarClassName="profile-page-avatar"
            avatarSet={avatarSet} avatarVersion={avatarVersion} editBusy={editBusy} onChangeAvatar={onChangeAvatar} />
        </>}
        actions={<>
            <button type="button" className="profile-page-primary" onClick={onCreateStory}><Plus size={18} aria-hidden="true" />Thêm vào tin</button>
            <button type="button" className="profile-page-secondary" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa trang cá nhân</button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="profile-page-more" aria-label="Tùy chọn hồ sơ"><ChevronDown size={19} aria-hidden="true" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onCreatePost}><Plus size={18} aria-hidden="true" />Đăng bài mới</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSection('media')}><ImageIcon size={18} aria-hidden="true" />Ảnh &amp; video</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </>} />
      <ProfileTabs tabs={tabs} active={section} onChange={setSection}
        action={section !== 'posts' && (
          <button type="button" className="profile-page-post-action" onClick={onReloadPosts}
            disabled={postsBusy} aria-label="Làm mới nội dung"><RefreshCw size={17} aria-hidden="true" /></button>
        )} />

      <div className="profile-page-columns">
        <ProfileSidebar username={username} email={email} bio={bio} city={city} friends={acceptedFriends} media={media}
          highlights={highlights}
          onEditProfile={onEditProfile} onShowMedia={() => setSection('media')} onShowFriends={() => setSection('friends')}
          onViewFriend={onViewFriend} onOpenPost={onOpenPost} />
        <section className="profile-page-main" aria-label="Nội dung trang cá nhân">
          <div id="profile-page-tab-content" role="tabpanel" aria-labelledby={`profile-page-tab-${section}`} className="profile-page-panel">
            {section === 'posts' && (
              <>
                <div className="profile-page-composer">
                  <PostStatusPrompt
                    username={username}
                    displayName={displayName}
                    avatarClassName="profile-page-composer-avatar"
                    prompt={`${displayName.split(' ').slice(-1)[0]} ơi, bạn đang nghĩ gì?`}
                    onCreatePost={onCreatePost}
                  />
                </div>
                <div className="profile-page-about profile-page-timeline-heading"><h2>Bài viết</h2></div>
                {postsError && <div className="profile-page-error" role="alert">{postsError}
                  <button type="button" onClick={onReloadPosts}>Thử lại</button></div>}
                <div className="profile-page-post-feed feed zalo-feed">{postCards}</div>
                {!postsBusy && !postsError && posts.length === 0 && !pendingPost &&
                  <div className="profile-page-blank"><ImageIcon size={30} aria-hidden="true" /><p>Bạn chưa có bài viết nào.</p>
                    <button type="button" onClick={onCreatePost}>Đăng bài đầu tiên</button></div>}
                {hasMorePosts && <button className="profile-page-more-posts" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>
                  Xem bài viết cũ hơn <ArrowRight size={16} aria-hidden="true" /></button>}
              </>
            )}
            {section === 'media' && (
              <div className="profile-page-subsection">
                <h2>Ảnh & video</h2>
                <p>Ảnh và video từ các bài viết đã tải của bạn.</p>
                <ProfileMediaGallery items={media} emptyText="Chưa có ảnh hoặc video trong các bài viết đã tải." postsBusy={postsBusy} onOpenPost={onOpenPost} onCreatePost={onCreatePost} />
                {hasMorePosts && <button className="profile-page-more-posts" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>Tải thêm bài viết để xem ảnh cũ hơn</button>}
              </div>
            )}
            {section === 'about' && (
              <div className="profile-page-subsection">
                <h2>Giới thiệu</h2>
                <p>Thông tin tài khoản của bạn trên SocCo.</p>
                <div className="profile-page-info-line"><UserRound size={19} aria-hidden="true" /><span>Tên hiển thị</span><strong>{displayName}</strong></div>
                <div className="profile-page-info-line"><Users size={19} aria-hidden="true" /><span>Tên người dùng</span><strong>@{username}</strong></div>
                {bio && <div className="profile-page-info-line"><UserRound size={19} aria-hidden="true" /><span>Tiểu sử</span><strong>{bio}</strong></div>}
                {city && <div className="profile-page-info-line"><MapPin size={19} aria-hidden="true" /><span>Thành phố</span><strong>{city}</strong></div>}
                {email && <div className="profile-page-info-line"><Mail size={19} aria-hidden="true" /><span>Email (chỉ bạn xem)</span><strong>{email}</strong></div>}
                <button type="button" className="profile-page-info-edit" onClick={onEditProfile}><PencilLine size={17} /> Chỉnh sửa thông tin</button>
              </div>
            )}
            {section === 'friends' && (
              <div className="profile-page-subsection">
                <h2>Bạn bè của bạn</h2>
                <p>{acceptedFriends.length.toLocaleString('vi-VN')} liên hệ đã kết bạn.</p>
                <div className="profile-page-friends">
                  {acceptedFriends.slice(0, 12).map(friend => (
                    <button type="button" key={friend.id} className="profile-page-friend"
                      onClick={() => onViewFriend(friend.username)} title={`Xem hồ sơ ${friend.displayName || friend.username}`}>
                      <UserAvatar username={friend.username} name={friend.displayName || friend.username} className="profile-page-friend-avatar" online={friend.online} />
                      <span><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}</small></span><ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {acceptedFriends.length === 0 && <p className="profile-page-hint">Chưa có bạn bè trong danh bạ.</p>}
                <button type="button" className="profile-page-info-edit" onClick={onOpenContacts}>Mở danh bạ <ArrowRight size={16} /></button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}