import { useUiTranslation } from '@/shared/i18n/locale'
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, MapPin, Camera, ChevronDown, Image as ImageIcon, Mail, PencilLine, Plus, RefreshCw, Users, UserRound } from 'lucide-react'
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
  const trUi = useUiTranslation()

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
    <div className="profile-page" aria-label={trUi("profile.profile")}>
      <ProfileHero displayName={displayName} username={username} city={city} workplace={workplace} school={school} friendCount={acceptedFriends.length}
        coverUrl={coverSet ? coverUrl : undefined}
        coverAction={<button type="button" className="profile-page-cover-action" onClick={onChangeCover}
          disabled={editBusy} title={trUi("common.ui.changeCover")}><Camera size={17} aria-hidden="true" /><span>{coverSet ? trUi("profile.coverChange") : 'Thêm ảnh bìa'}</span></button>}
        avatar={<>
          {profileNote}
          <ProfileAvatarMenu username={username} displayName={displayName} avatarClassName="profile-page-avatar"
            avatarSet={avatarSet} avatarVersion={avatarVersion} editBusy={editBusy} onChangeAvatar={onChangeAvatar} />
        </>}
        actions={<>
            <button type="button" className="profile-page-primary" onClick={onCreateStory}><Plus size={18} aria-hidden="true" />Thêm vào tin</button>
            <button type="button" className="profile-page-secondary" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />{trUi("profile.editPersonal")}</button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="profile-page-more" aria-label={trUi("common.ui.profileOptions")}><ChevronDown size={19} aria-hidden="true" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onCreatePost}><Plus size={18} aria-hidden="true" />Đăng bài mới</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSection('media')}><ImageIcon size={18} aria-hidden="true" />{trUi("common.photoAmpVideo")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </>} />
      <ProfileTabs tabs={tabs} active={section} onChange={setSection}
        action={section !== 'posts' && (
          <button type="button" className="profile-page-post-action" onClick={onReloadPosts}
            disabled={postsBusy} aria-label={trUi("common.ui.refreshContent")}><RefreshCw size={17} aria-hidden="true" /></button>
        )} />

      <div className="profile-page-columns">
        <ProfileSidebar username={username} email={email} bio={bio} city={city} friends={acceptedFriends} media={media}
          highlights={highlights}
          onEditProfile={onEditProfile} onShowMedia={() => setSection('media')} onShowFriends={() => setSection('friends')}
          onViewFriend={onViewFriend} onOpenPost={onOpenPost} />
        <section className="profile-page-main" aria-label={trUi("profile.profileContent")}>
          <div id="profile-page-tab-content" role="tabpanel" aria-labelledby={`profile-page-tab-${section}`} className="profile-page-panel app-desktop:flex app-desktop:min-w-0 app-desktop:flex-col app-desktop:gap-4">
            {section === 'posts' && (
              <>
                <PostComposerLauncher
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
                <div className="profile-page-about profile-page-timeline-heading"><h2>{trUi("feed.post")}</h2></div>
                {postsError && <div className="profile-page-error" role="alert">{postsError}
                  <button type="button" onClick={onReloadPosts}>{trUi("common.retry")}</button></div>}
                <div className="profile-page-post-feed feed zalo-feed app-desktop:flex app-desktop:min-w-0 app-desktop:flex-col app-desktop:gap-4">{postCards}</div>
                {!postsBusy && !postsError && posts.length === 0 && !pendingPost &&
                  <div className="profile-page-blank"><ImageIcon size={30} aria-hidden="true" /><p>Bạn chưa có bài viết nào.</p>
                    <button type="button" onClick={onCreatePost}>{trUi("feed.firstPost")}</button></div>}
                {hasMorePosts && <button className="profile-page-more-posts app-desktop:mt-[15px] app-desktop:flex app-desktop:min-h-[42px] app-desktop:w-full app-desktop:cursor-pointer app-desktop:items-center app-desktop:justify-center app-desktop:gap-2 app-desktop:rounded-[11px] app-desktop:border app-desktop:border-[#dde7fa] app-desktop:bg-[#f5f7ff] app-desktop:text-xs app-desktop:font-bold app-desktop:text-[#315fc6]" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>{trUi("profile.olderPosts") + ' '}<ArrowRight size={16} aria-hidden="true" /></button>}
              </>
            )}
            {section === 'media' && (
              <div className="profile-page-subsection">
                <h2>{trUi("common.photoAmpVideo")}</h2>
                <p>Ảnh và video từ các bài viết đã tải của bạn.</p>
                <ProfileMediaGallery items={media} emptyText="Chưa có ảnh hoặc video trong các bài viết đã tải." postsBusy={postsBusy} onOpenPost={onOpenPost} onCreatePost={onCreatePost} />
                {hasMorePosts && <button className="profile-page-more-posts app-desktop:mt-[15px] app-desktop:flex app-desktop:min-h-[42px] app-desktop:w-full app-desktop:cursor-pointer app-desktop:items-center app-desktop:justify-center app-desktop:gap-2 app-desktop:rounded-[11px] app-desktop:border app-desktop:border-[#dde7fa] app-desktop:bg-[#f5f7ff] app-desktop:text-xs app-desktop:font-bold app-desktop:text-[#315fc6]" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>Tải thêm bài viết để xem ảnh cũ hơn</button>}
              </div>
            )}
            {section === 'about' && (
              <div className="profile-page-subsection">
                <h2>{trUi("common.about")}</h2>
                <p>Thông tin tài khoản của bạn trên SocCo.</p>
                <div className="profile-page-info-line"><UserRound size={19} aria-hidden="true" /><span>{trUi("profile.displayName")}</span><strong>{displayName}</strong></div>
                <div className="profile-page-info-line"><Users size={19} aria-hidden="true" /><span>{trUi("profile.username")}</span><strong>@{username}</strong></div>
                {bio && <div className="profile-page-info-line"><UserRound size={19} aria-hidden="true" /><span>{trUi("profile.bio")}</span><strong>{bio}</strong></div>}
                {city && <div className="profile-page-info-line"><MapPin size={19} aria-hidden="true" /><span>{trUi("profile.city")}</span><strong>{city}</strong></div>}
                {email && <div className="profile-page-info-line"><Mail size={19} aria-hidden="true" /><span>Email (chỉ bạn xem)</span><strong>{email}</strong></div>}
                <button type="button" className="profile-page-info-edit" onClick={onEditProfile}><PencilLine size={17} />{trUi("common.editInfo")}</button>
              </div>
            )}
            {section === 'friends' && (
              <div className="profile-page-subsection">
                <h2>Bạn bè của bạn</h2>
                <p>{acceptedFriends.length.toLocaleString('vi-VN')} liên hệ đã kết bạn.</p>
                <div className="profile-page-friends app-desktop:grid app-desktop:grid-cols-2 app-desktop:gap-2.5">
                  {acceptedFriends.slice(0, 12).map(friend => (
                    <button type="button" key={friend.id} className="profile-page-friend app-desktop:flex app-desktop:min-w-0 app-desktop:cursor-pointer app-desktop:items-center app-desktop:gap-[11px] app-desktop:rounded-xl app-desktop:border app-desktop:border-[#e9edf5] app-desktop:bg-white app-desktop:p-3 app-desktop:text-left app-desktop:hover:bg-[#f6f8ff] app-desktop:[&>svg]:shrink-0 app-desktop:[&>svg]:text-[#9aabc6]"
                      onClick={() => onViewFriend(friend.username)} title={trUi("common.ui.viewProfileNamed", { v1: String(friend.displayName || friend.username) })}>
                      <UserAvatar username={friend.username} name={friend.displayName || friend.username} className="profile-page-friend-avatar" online={friend.online} />
                      <span><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}</small></span><ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {acceptedFriends.length === 0 && <p className="profile-page-hint app-desktop:text-[13px] app-desktop:text-[#8391a9]">Chưa có bạn bè trong danh bạ.</p>}
                <button type="button" className="profile-page-info-edit" onClick={onOpenContacts}>{trUi("contacts.openContacts") + ' '}<ArrowRight size={16} /></button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}