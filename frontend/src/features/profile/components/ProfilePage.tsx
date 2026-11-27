import { useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()

  const [section, setSection] = useState<Section>('posts')
  const acceptedFriends = useMemo(() => friends.filter(friend => friend.status === 'accepted'), [friends])
  const media = useMemo<ProfileMediaItem[]>(() => posts.flatMap(post => (post.attachments || [])
    .filter(item => (item.kind === 'image' || item.kind === 'video') && item.url)
    .map((attachment, index) => ({ postId: post.id, attachment, index }))), [posts])
  const tabs: { id: Section; label: string }[] = [
    { id: 'posts', label: trUi('discover.posts') },
    { id: 'about', label: trUi('common.about') },
    { id: 'friends', label: trUi('contacts.friends') },
    { id: 'image', label: trUi('common.photos') },
    { id: 'video', label: trUi('common.ui.video') },
  ]


  return (
    <div className="profile-page app-desktop:px-0!" aria-label={trUi("profile.profile")}>
      <ProfileHero desktopMasthead bio={bio} displayName={displayName} username={username} city={city} workplace={workplace} school={school} friendCount={acceptedFriends.length}
        coverUrl={coverSet ? coverUrl : undefined}
        coverAction={<button type="button" className="profile-page-cover-action" onClick={onChangeCover}
          disabled={editBusy} title={trUi("common.ui.changeCover")}><Camera size={17} aria-hidden="true" /><span>{coverSet ? trUi("profile.coverChange") : trUi('profile.addCover')}</span></button>}
        avatar={<>
          {profileNote}
          <ProfileAvatarMenu username={username} displayName={displayName} avatarClassName="profile-page-avatar app-desktop:size-full!" cameraBadge
            avatarSet={avatarSet} avatarVersion={avatarVersion} editBusy={editBusy} onChangeAvatar={onChangeAvatar} />
        </>}
        actions={<>
            <Button className="font-semibold!" onClick={onCreateStory}><Plus size={18} aria-hidden="true" />{trUi('profile.addToStory')}</Button>
            <Button variant="secondary" className="font-semibold!" onClick={onEditProfile}><PencilLine size={17} aria-hidden="true" />{trUi('profile.editPersonal')}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="profile-page-more" aria-label={trUi("common.ui.profileOptions")}><ChevronDown size={19} aria-hidden="true" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onCreatePost}><Plus size={18} aria-hidden="true" />{trUi('profile.newPost')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSection('image')}><ImageIcon size={18} aria-hidden="true" />{trUi("common.photos")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </>} />
      <div className="sticky top-0 z-12 w-full border-0 border-b border-solid border-border-subtle bg-card">
      <ProfileTabs className="app-desktop:relative app-desktop:max-w-[1024px]! app-desktop:w-[calc(100%_-_2*var(--soco-space-4))] app-desktop:min-h-14 app-desktop:gap-0 app-desktop:shadow-none app-desktop:px-0" tabs={tabs} active={section} onChange={setSection}
        action={<DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="ml-auto shrink-0" aria-label={trUi("profile.contentOptions")}><Ellipsis size={20} aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreatePost}><Plus size={18} aria-hidden="true" />{trUi('profile.newPost')}</DropdownMenuItem>
            <DropdownMenuItem disabled={postsBusy} onSelect={onReloadPosts}><RefreshCw size={17} aria-hidden="true" />{trUi('common.ui.refreshContent')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>} />
      </div>

      <div className="profile-page-columns app-desktop:box-border app-desktop:w-[calc(100%_-_2*var(--soco-space-4))] app-desktop:max-w-[1024px]! app-desktop:px-0 app-desktop:grid-cols-[minmax(0,calc((100%_-_var(--soco-space-3))*5/12_+_8px))_minmax(0,1fr)] app-desktop:gap-ui-3">
        <ProfileSidebar username={username} email={email} bio={bio} city={city} workplace={workplace} school={school} friends={acceptedFriends} media={media.filter(item => item.attachment.kind === "image")}
          highlights={highlights}
          onEditProfile={onEditProfile} onShowMedia={() => setSection('image')} onShowFriends={() => setSection('friends')}
          onViewFriend={onViewFriend} onOpenPost={onOpenPost} />
        <section className="profile-page-main" aria-label={trUi("profile.profileContent")}>
          <div id="profile-page-tab-content" role="tabpanel" aria-labelledby={`profile-page-tab-${section}`} className="profile-page-panel app-desktop:flex app-desktop:min-w-0 app-desktop:flex-col app-desktop:gap-4">
            {section === 'posts' && (
              <>
                <PostComposerLauncher
                  layout="stacked"
                  username={username}
                  displayName={displayName}
                  hasDraft={Boolean(postDraft.trim())}
                  onCreatePost={onCreatePost}
                  onCreateMediaPost={onCreateMediaPost}
                  onCreateStory={onCreateStory}
                  onCheckIn={onCheckIn}
                  pending={composerPending}
                  storyBusy={storyBusy}
                />
                <div className="profile-page-about flex items-center justify-between gap-ui-2 rounded-ui-lg border border-solid border-border-subtle bg-card px-ui-3! py-ui-2!">
                  <h2 className="text-foreground!">{trUi('feed.post')}</h2>
                  <Button variant="secondary" size="sm" disabled={postsBusy} onClick={onReloadPosts}><RefreshCw size={16} aria-hidden="true" />{trUi('common.refresh')}</Button>
                </div>
                {postsBusy && posts.length === 0 && !pendingPost && !postsError && (
                  <div role="status" aria-live="polite" aria-busy="true" className="grid gap-3">
                    <span className="sr-only">{trUi('common.ui.loadingPostsDots')}</span>
                    <div aria-hidden="true" className="grid animate-pulse gap-3 rounded-ui-lg border border-border bg-card p-4 motion-reduce:animate-none">
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 rounded-full bg-muted" />
                        <div className="grid flex-1 gap-2">
                          <div className="h-3 w-28 rounded bg-muted" />
                          <div className="h-2 w-16 rounded bg-muted" />
                        </div>
                      </div>
                      <div className="h-3 w-3/4 rounded bg-muted" />
                      <div className="aspect-[4/3] w-full rounded-ui-md bg-muted" />
                    </div>
                  </div>
                )}
                {postsError && <div className="profile-page-error" role="alert">{postsError}
                  <button type="button" onClick={onReloadPosts}>{trUi("common.retry")}</button></div>}
                <div className="profile-page-post-feed feed zalo-feed app-desktop:flex app-desktop:min-w-0 app-desktop:flex-col app-desktop:gap-4">{postCards}</div>
                {!postsBusy && !postsError && posts.length === 0 && !pendingPost &&
                  <div className="profile-page-blank"><ImageIcon size={30} aria-hidden="true" /><p>{trUi('profile.noOwnPosts')}</p>
                    <button type="button" onClick={onCreatePost}>{trUi("feed.firstPost")}</button></div>}
                {hasMorePosts && <button className="profile-page-more-posts app-desktop:mt-[15px] app-desktop:flex app-desktop:min-h-[42px] app-desktop:w-full app-desktop:cursor-pointer app-desktop:items-center app-desktop:justify-center app-desktop:gap-2 app-desktop:rounded-[11px] app-desktop:border app-desktop:border-[#dde7fa] app-desktop:bg-[#f5f7ff] app-desktop:text-xs app-desktop:font-bold app-desktop:text-[#315fc6]" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>{trUi("profile.olderPosts") + ' '}<ArrowRight size={16} aria-hidden="true" /></button>}
              </>
            )}
            {(section === 'image' || section === 'video') && (
              <div className="profile-page-subsection">
                <h2>{trUi(section === "image" ? "common.photos" : "common.ui.video")}</h2>
                <ProfileMediaGallery items={media.filter(item => item.attachment.kind === section)} emptyText={trUi(section === "image" ? "profile.noLoadedPhotos" : "profile.noLoadedVideos")} postsBusy={postsBusy} onOpenPost={onOpenPost} onCreatePost={onCreatePost} />
                {hasMorePosts && <button className="profile-page-more-posts app-desktop:mt-[15px] app-desktop:flex app-desktop:min-h-[42px] app-desktop:w-full app-desktop:cursor-pointer app-desktop:items-center app-desktop:justify-center app-desktop:gap-2 app-desktop:rounded-[11px] app-desktop:border app-desktop:border-[#dde7fa] app-desktop:bg-[#f5f7ff] app-desktop:text-xs app-desktop:font-bold app-desktop:text-[#315fc6]" type="button" onClick={onLoadMorePosts} disabled={postsBusy}>{trUi("profile.loadOlderPosts")}</button>}
              </div>
            )}
            {section === 'about' && (
              <div className="profile-page-subsection">
                <h2>{trUi("common.about")}</h2>
                <p>{trUi('profile.accountHint')}</p>
                <div className="profile-page-info-line"><UserRound size={19} aria-hidden="true" /><span>{trUi("profile.displayName")}</span><strong>{displayName}</strong></div>
                <div className="profile-page-info-line"><Users size={19} aria-hidden="true" /><span>{trUi("profile.username")}</span><strong>@{username}</strong></div>
                {bio && <div className="profile-page-info-line"><UserRound size={19} aria-hidden="true" /><span>{trUi("profile.bio")}</span><strong>{bio}</strong></div>}
                {city && <div className="profile-page-info-line"><MapPin size={19} aria-hidden="true" /><span>{trUi("profile.city")}</span><strong>{city}</strong></div>}
                {email && <div className="profile-page-info-line"><Mail size={19} aria-hidden="true" /><span>{trUi('profile.privateEmail')}</span><strong>{email}</strong></div>}
                <button type="button" className="profile-page-info-edit" onClick={onEditProfile}><PencilLine size={17} />{trUi("common.editInfo")}</button>
              </div>
            )}
            {section === 'friends' && (
              <div className="profile-page-subsection">
                <h2>{trUi('profile.yourFriends')}</h2>
                <p>{trUi('profile.friendCount', { count: acceptedFriends.length })}</p>
                <div className="profile-page-friends app-desktop:grid app-desktop:grid-cols-2 app-desktop:gap-2.5">
                  {acceptedFriends.slice(0, 12).map(friend => (
                    <button type="button" key={friend.id} className="profile-page-friend app-desktop:flex app-desktop:min-w-0 app-desktop:cursor-pointer app-desktop:items-center app-desktop:gap-[11px] app-desktop:rounded-xl app-desktop:border app-desktop:border-[#e9edf5] app-desktop:bg-white app-desktop:p-3 app-desktop:text-left app-desktop:hover:bg-[#f6f8ff] app-desktop:[&>svg]:shrink-0 app-desktop:[&>svg]:text-[#9aabc6]"
                      onClick={() => onViewFriend(friend.username)} title={trUi("common.ui.viewProfileNamed", { v1: String(friend.displayName || friend.username) })}>
                      <UserAvatar username={friend.username} name={friend.displayName || friend.username} className="profile-page-friend-avatar" online={friend.online} />
                      <span><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}</small></span><ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {acceptedFriends.length === 0 && <p className="profile-page-hint app-desktop:text-[13px] app-desktop:text-[#8391a9]">{trUi('contacts.emptyDirectory')}</p>}
                <button type="button" className="profile-page-info-edit" onClick={onOpenContacts}>{trUi("contacts.openContacts") + ' '}<ArrowRight size={16} /></button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
