import { userLabel } from '../../shared/lib/userLabel'
import type { Dispatch, SetStateAction, RefObject, FormEvent } from 'react'
import type { Post } from './types'
import type { MediaAttachment } from '../../shared/lib/media'
import UserAvatar from '../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../shared/ui/MediaAttachmentsView'
import UiIcon from '../../shared/ui/UiIcon'

type Props = {
  name: string
  popup?: boolean
  displayName?: string
  submitError?: string
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
  const postAudience = (
    <label>Ai có thể xem?
      <select disabled={!!pendingPost} value={postVisibility} onChange={event => setPostVisibility(event.target.value as typeof postVisibility)}>
        <option value="public">🌐 Công khai</option>
        <option value="friends">👥 Bạn bè</option>
        <option value="private">🔒 Chỉ mình tôi</option>
      </select>
    </label>
  )
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
      {mediaUploading === 'feed' && <div className="media-uploading-note">Đang tải media thẳng lên kho lưu trữ…</div>}
      {popup && submitError && <p className="profile-post-error" role="alert">{submitError}</p>}
      {(popup || postText.trim() || postAttachments.length > 0) && (
        <button className="feed-submit" disabled={!!pendingPost || !!mediaUploading || (!postText.trim() && postAttachments.length === 0)}>{pendingPost ? 'Đang đăng...' : 'Đăng'}</button>
      )}
    </form>
  )
}