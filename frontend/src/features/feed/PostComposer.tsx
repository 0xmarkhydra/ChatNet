import { useLayoutEffect } from 'react'
import { userLabel } from '../../shared/lib/userLabel'
import type { Dispatch, SetStateAction, RefObject, FormEvent } from 'react'
import type { Post } from './types'
import type { MediaAttachment } from '../../shared/lib/media'
import UserAvatar from '../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../shared/ui/MediaAttachmentsView'
import UiIcon from '../../shared/ui/UiIcon'
import PrivacyPicker from './PrivacyPicker'

type Props = {
  name: string
  popup?: boolean
  displayName?: string
  submitError?: string
  checkInOpen?: boolean
  checkInLocation?: string
  setCheckInLocation?: (location: string) => void
  createPost: (event: FormEvent) => void
  postComposerRef: RefObject<HTMLTextAreaElement | null>
  postBackground: string
  pendingPost: Post | null
  postText: string
  setPostText: (text: string) => void
  feedImageInputRef: RefObject<HTMLInputElement | null>
  feedVideoInputRef: RefObject<HTMLInputElement | null>
  feedAlbumInputRef: RefObject<HTMLInputElement | null>
  addFeedFiles: (files: File[]) => Promise<void>
  postAttachments: MediaAttachment[]
  setPostAttachments: Dispatch<SetStateAction<MediaAttachment[]>>
  mediaUploading: 'chat' | 'feed' | 'story' | 'profile' | null
  showPostBackgrounds: boolean
  setShowPostBackgrounds: Dispatch<SetStateAction<boolean>>
  postVisibility: 'public' | 'friends' | 'private'
  setPostVisibility: (visibility: 'public' | 'friends' | 'private') => void
  setPostBackground: (background: string) => void
}

export default function PostComposer({
  name,
  popup = false,
  displayName,
  submitError,
  checkInOpen = false,
  checkInLocation = '',
  setCheckInLocation,
  createPost,
  postComposerRef,
  postBackground,
  pendingPost,
  postText,
  setPostText,
  feedImageInputRef,
  feedVideoInputRef,
  feedAlbumInputRef,
  addFeedFiles,
  postAttachments,
  setPostAttachments,
  mediaUploading,
  showPostBackgrounds,
  setShowPostBackgrounds,
  postVisibility,
  setPostVisibility,
  setPostBackground,
}: Props) {
  // Expand the popup text field with its content and avoid an inner scrollbar.
  useLayoutEffect(() => {
    if (!popup) return
    const textarea = postComposerRef.current
    if (!textarea) return
    const resize = () => {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [popup, postText, postBackground, postComposerRef])

  const postAudience = <PrivacyPicker disabled={!!pendingPost} value={postVisibility} onChange={setPostVisibility} />
  return (
    <form className={`post-box zalo-post-composer ${popup ? 'profile-popup-composer' : ''}`} onSubmit={createPost}>
      <div className="post-prompt compact-post-prompt">
        <UserAvatar username={name} name={userLabel(displayName, name)} className="avatar self-avatar" />
        {popup && <div className="profile-post-author">
          <strong>{displayName || name}</strong>
          {postAudience}
        </div>}
        <textarea
          ref={postComposerRef}
          className={postBackground ? 'feed-composer-bg bg-' + postBackground : ''}
          disabled={!!pendingPost}
          aria-label="Nội dung bài viết"
          placeholder="Hôm nay bạn thế nào?"
          value={postText}
          onChange={(event) => setPostText(event.target.value)}
          rows={1}
          maxLength={5000}
        />
      </div>
      <input
        ref={feedImageInputRef}
        className="hidden-media-input"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files || [])
          event.currentTarget.value = ''
          void addFeedFiles(files)
        }}
      />
      <input
        ref={feedVideoInputRef}
        className="hidden-media-input"
        type="file"
        accept="video/*"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files || [])
          event.currentTarget.value = ''
          void addFeedFiles(files)
        }}
      />
      <input
        ref={feedAlbumInputRef}
        className="hidden-media-input"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files || [])
          event.currentTarget.value = ''
          void addFeedFiles(files)
        }}
      />
      {popup && checkInOpen && setCheckInLocation && (
        <label className="social-feed-checkin-field">
          <strong>Địa điểm check-in</strong>
          <input type="text" aria-label="Địa điểm check-in" value={checkInLocation} maxLength={120}
            onChange={event => setCheckInLocation(event.target.value)}
            placeholder="Ví dụ: Đà Lạt, Việt Nam" disabled={!!pendingPost} />
          <small>Địa điểm sẽ được ghi vào nội dung bài viết; không chia sẻ GPS.</small>
        </label>
      )}
      {postAttachments.length > 0 && (
        <div className="feed-pending-media">
          <MediaAttachmentsView
            items={postAttachments}
            pending
            onRemove={pendingPost ? undefined : (index) => setPostAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
          />
        </div>
      )}
      <div className="composer-shortcuts">
        <button type="button" disabled={!!pendingPost || mediaUploading === 'feed'} onClick={() => feedImageInputRef.current?.click()}><UiIcon name="photo" size={20} />Ảnh</button>
        <button type="button" disabled={!!pendingPost || mediaUploading === 'feed'} onClick={() => feedVideoInputRef.current?.click()}><UiIcon name="video" size={20} />Video</button>
        <button type="button" disabled={!!pendingPost || mediaUploading === 'feed'} onClick={() => feedAlbumInputRef.current?.click()}><UiIcon name="album" size={20} />Album</button>
        <button type="button" aria-expanded={showPostBackgrounds} onClick={() => { setShowPostBackgrounds(v => !v); postComposerRef.current?.focus() }}><UiIcon name="text" size={20} />Nền chữ</button>
      </div>
      <div className="feed-composer-settings">
        {!popup && postAudience}
        {showPostBackgrounds && <div className="feed-background-palette" aria-label="Chọn nền bài viết">
          {['', 'violet', 'blue', 'sunset', 'mint', 'night'].map(bg => (
            <button key={bg || 'none'} type="button" className={'feed-palette-dot bg-' + (bg || 'none')}
              aria-pressed={postBackground === bg} aria-label={bg || 'Không nền'} onClick={() => setPostBackground(bg)}>
              {postBackground === bg ? '✓' : ''}
            </button>
          ))}
        </div>}
      </div>

      {popup && submitError && <p className="profile-post-error" role="alert">{submitError}</p>}
      {(popup || postText.trim() || postAttachments.length > 0) && (
        <button className="feed-submit" disabled={!!pendingPost || !!mediaUploading || (!postText.trim() && postAttachments.length === 0 && !(checkInOpen && checkInLocation.trim()))}>Đăng</button>
      )}
    </form>
  )
}