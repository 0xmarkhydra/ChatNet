import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, MapPin, Camera, ChevronDown, Image as ImageIcon, Mail, PencilLine, Plus, RefreshCw, Users, UserRound, Ellipsis } from 'lucide-react'
import type { Post } from '../../feed'
import type { FriendConnection } from '../../contacts'
import ProfileMediaGallery, { type ProfileMediaItem } from './ProfileMediaGallery'
import ProfileSidebar from './ProfileSidebar'
import UserAvatar from '../../../shared/ui/UserAvatar'
import PostComposerLauncher from '../../../shared/ui/PostComposerLauncher'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import ProfileAvatarMenu from './ProfileAvatarMenu'
import ProfileHero from './ProfileHero'
import ProfileTabs from './ProfileTabs'
import { Button } from '@/shared/ui/button'

type Section = 'posts' | 'image' | 'video' | 'about' | 'friends'

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
  onCreateMediaPost: (files: File[]) => void
  onCreateStory: () => void
  onCheckIn: () => void
  composerPending?: boolean
  storyBusy?: boolean
  postDraft?: string
  onReloadPosts: () => void
  onLoadMorePosts: () => void
  onViewFriend: (username: string) => void
  onOpenContacts: () => void
  onOpenPost: (postId: number) => void
}

export default function ProfilePage({
  highlights, username, displayName, email, bio, city, workplace, school, coverUrl, coverSet, avatarSet, avatarVersion, editBusy, friends,
  posts, pendingPost, postsBusy, postsError, hasMorePosts, postCards, profileNote,
  onEditProfile, onChangeAvatar, onChangeCover, onCreatePost, onCreateMediaPost, onCreateStory, onCheckIn,
  composerPending = false, storyBusy = false, postDraft = '',
  onReloadPosts, onLoadMorePosts, onViewFriend, onOpenContacts, onOpenPost,
}: Props) {
  const [section, setSection] = useState<Section>('posts')
  const acceptedFriends = useMemo(() => friends.filter(friend => friend.status === 'accepted'), [friends])
  const media = useMemo<ProfileMediaItem[]>(() => posts.flatMap(post => (post.attachments || [])
    .filter(item => (item.kind === 'image' || item.kind === 'video') && item.url)
    .map((attachment, index) => ({ postId: post.id, attachment, index }))), [posts])
  const tabs: { id: Section; label: string }[] = [
    { id: 'posts', label: 'Bài viết' },
    { id: 'about', label: 'Giới thiệu' },
    { id: 'friends', label: 'Bạn bè' },
    { id: 'image', label: 'Ảnh' },
    { id: 'video', label: 'Video' },
  ]


  return (
    <div className="profile-page app-desktop:px-0!" aria-label="Trang cá nhân">
      <ProfileHero desktopMasthead bio={bio} displayName={displayName} username={username} city={city} workplace={workplace} school={school} friendCount={acceptedFriends.length}
        coverUrl={coverSet ? coverUrl : undefined}
        coverAction={<button type="button" className="profile-page-cover-action" onClick={onChangeCover}
          disabled={editBusy} title="Thay đổi ảnh bìa"><Camera size={17} aria-hidden="true" /><span>{coverSet ? 'Đổi ảnh bìa' : 'Thêm ảnh bìa'}</span></button>}
        avatar={<>
          {profileNote}
          <ProfileAvatarMenu username={username} displayName={displayName} avatarClassName="profile-page-avatar app-desktop:size-full!" cameraBadge
            avatarSet={avatarSet} avatarVersion={avatarVersion} editBusy={editBusy} onChangeAvatar={onChangeAvatar} />
        </>}
        actions={<>
            <Button className="font-semibold!" onClick={onCreateStory}><Plus size={18} aria-hidden="true" />Thêm vào tin</Button>
            <Button variant="secondary" className="font-semibold!" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />Chỉnh sửa trang cá nhân</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="profile-page-more" aria-label="Tùy chọn hồ sơ"><ChevronDown size={19} aria-hidden="true" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onCreatePost}><Plus size={18} aria-hidden="true" />Đăng bài mới</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSection('image')}><ImageIcon size={18} aria-hidden="true" />Ảnh</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </>} />
      <div className="sticky top-0 z-12 w-full border-0 border-b border-solid border-border-subtle bg-card">
      <ProfileTabs className="app-desktop:relative app-desktop:max-w-[1024px]! app-desktop:w-[calc(100%_-_2*var(--soco-space-4))] app-desktop:min-h-14 app-desktop:gap-0 app-desktop:shadow-none app-desktop:px-0" tabs={tabs} active={section} onChange={setSection}
        action={<DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="ml-auto shrink-0" aria-label="Tùy chọn nội dung hồ sơ"><Ellipsis size={20} aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreatePost}><Plus size={18} aria-hidden="true" />Đăng bài mới</DropdownMenuItem>
            <DropdownMenuItem disabled={postsBusy} onSelect={onReloadPosts}><RefreshCw size={17} aria-hidden="true" />Làm mới nội dung</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>} />
      </div>

      <div className="profile-page-columns app-desktop:box-border app-desktop:w-[calc(100%_-_2*var(--soco-space-4))] app-desktop:max-w-[1024px]! app-desktop:px-0 app-desktop:grid-cols-[minmax(0,calc((100%_-_var(--soco-space-3))*5/12_+_8px))_minmax(0,1fr)] app-desktop:gap-ui-3">
        <ProfileSidebar username={username} email={email} bio={bio} city={city} workplace={workplace} school={school} friends={acceptedFriends} media={media.filter(item => item.attachment.kind === "image")}
          highlights={highlights}
          onEditProfile={onEditProfile} onShowMedia={() => setSection('image')} onShowFriends={() => setSection('friends')}
          onViewFriend={onViewFriend} onOpenPost={onOpenPost} />
        <section className="profile-page-main" aria-label="Nội dung trang cá nhân">
          <div id="profile-page-tab-content" role="tabpanel" aria-labelledby={`profile-page-tab-${section}`} className="profile-page-panel app-desktop:flex app-desktop:min-w-0 app-desktop:flex-col app-desktop:gap-4">
            {section === 'posts' && (
              <>
                <PostComposerLauncher
                  layout="stacked"
                  username={username}
                  displayName={displayName}
                  prompt={postDraft.trim() ? 'Tiếp tục bài viết của bạn...' : 'Bạn đang nghĩ gì?'}
                  onCreatePost={onCreatePost}
                  onCreateMediaPost={onCreateMediaPost}
                  onCreateStory={onCreateStory}
                  onCheckIn={onCheckIn}
                  pending={composerPending}
                  storyBusy={storyBusy}
                />
                <div className="profile-page-about flex items-center justify-between gap-ui-2 rounded-ui-lg border border-solid border-border-subtle bg-card px-ui-3! py-ui-2!">
                  <h2 className="text-foreground!">Bài viết</h2>
                  <Button variant="secondary" size="sm" disabled={postsBusy} onClick={onReloadPosts}><RefreshCw size={16} aria-hidden="true" />Làm mới</Button>
                </div>
                {postsError && <div className="profile-page-error" role="alert">{postsError}
                  <button type="button" onClick={onReloadPosts}>Thử lại</button></div>}
                <div className="profile-page-post-feed feed zalo-feed app-desktop:flex app-desktop:min-w-0 app-desktop:flex-col app-desktop:gap-4">{postCards}</div>
                {!postsBusy && !postsError && posts.length === 0 && !pendingPost &&
                  <div className="profile-page-blank"><ImageIcon size={30} aria-hidden="true" /><p>Bạn chưa có bài viết nào.</p>
                    <button type="button" onClick={onCreatePost}>Đăng bài đầu tiên</button></div>}
                {hasMorePosts && <button className="profile-page-more-posts app-desktop:mt-[15px] app-desktop:flex app-desktop:min-h-[42px] app-desktop:w-full app-desktop:cursor-pointer app-desktop:items-center app-desktop:justify-center app-desktop:gap-2 app-desktop:rounded-[11px] app-desktop:border app-desktop:border-[#dde7fa] app-desktop:bg-[#f5f7ff] app-desktop:text-xs app-desktop:font-bold app-desktop:text-[#315fc6]" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>
                  Xem bài viết cũ hơn <ArrowRight size={16} aria-hidden="true" /></button>}
              </>
            )}
            {(section === 'image' || section === 'video') && (
              <div className="profile-page-subsection">
                <h2>{section === "image" ? "Ảnh" : "Video"}</h2>
                <ProfileMediaGallery items={media.filter(item => item.attachment.kind === section)} emptyText={section === "image" ? "Chưa có ảnh trong các bài viết đã tải." : "Chưa có video trong các bài viết đã tải."} postsBusy={postsBusy} onOpenPost={onOpenPost} onCreatePost={onCreatePost} />
                {hasMorePosts && <button className="profile-page-more-posts app-desktop:mt-[15px] app-desktop:flex app-desktop:min-h-[42px] app-desktop:w-full app-desktop:cursor-pointer app-desktop:items-center app-desktop:justify-center app-desktop:gap-2 app-desktop:rounded-[11px] app-desktop:border app-desktop:border-[#dde7fa] app-desktop:bg-[#f5f7ff] app-desktop:text-xs app-desktop:font-bold app-desktop:text-[#315fc6]" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>Tải thêm bài viết cũ hơn</button>}
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
                <div className="profile-page-friends app-desktop:grid app-desktop:grid-cols-2 app-desktop:gap-2.5">
                  {acceptedFriends.slice(0, 12).map(friend => (
                    <button type="button" key={friend.id} className="profile-page-friend app-desktop:flex app-desktop:min-w-0 app-desktop:cursor-pointer app-desktop:items-center app-desktop:gap-[11px] app-desktop:rounded-xl app-desktop:border app-desktop:border-[#e9edf5] app-desktop:bg-white app-desktop:p-3 app-desktop:text-left app-desktop:hover:bg-[#f6f8ff] app-desktop:[&>svg]:shrink-0 app-desktop:[&>svg]:text-[#9aabc6]"
                      onClick={() => onViewFriend(friend.username)} title={`Xem hồ sơ ${friend.displayName || friend.username}`}>
                      <UserAvatar storyStatus="none" username={friend.username} name={friend.displayName || friend.username} className="profile-page-friend-avatar" online={friend.online} />
                      <span><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}</small></span><ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {acceptedFriends.length === 0 && <p className="profile-page-hint app-desktop:text-[13px] app-desktop:text-[#8391a9]">Chưa có bạn bè trong danh bạ.</p>}
                <button type="button" className="profile-page-info-edit" onClick={onOpenContacts}>Mở danh bạ <ArrowRight size={16} /></button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}