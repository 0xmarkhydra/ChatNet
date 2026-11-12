import { useLayoutEffect, useState } from 'react'
import { Image as ImageIcon, MapPin, Palette, SmilePlus, UserRoundPlus, X } from 'lucide-react'
import { userLabel } from '../../../shared/utils/userLabel'
import { feelingPostLine } from '../utils/feelings'
import PostTagPicker, { type TaggedFriend } from './PostTagPicker'
import PostFeelingPicker from './PostFeelingPicker'
import PostAudiencePicker from './PostAudiencePicker'
import type { Dispatch, SetStateAction, RefObject, FormEvent } from 'react'
import type { Post } from '../types'
import type { MediaAttachment } from '../../../shared/utils/media'
import UserAvatar from '../../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'

type Props = {
  name: string
  popup?: boolean
  editingPost?: Post | null
  editBusy?: boolean
  displayName?: string
  submitError?: string
  checkInOpen?: boolean
  checkInLocation?: string
  setCheckInLocation?: (location: string) => void
  setCheckInOpen?: (open: boolean) => void
  createPost: (event: FormEvent) => void
  postComposerRef: RefObject<HTMLTextAreaElement | null>
  postBackground: string
  pendingPost: Post | null
  postText: string
  setPostText: (text: string) => void
  taggableFriends: TaggedFriend[]
  taggedFriends: TaggedFriend[]
  setTaggedFriends: Dispatch<SetStateAction<TaggedFriend[]>>
  feelingId: string
  setFeelingId: (id: string) => void
  feedAlbumInputRef: RefObject<HTMLInputElement | null>
  addFeedFiles: (files: File[]) => Promise<void>
  postAttachments: MediaAttachment[]
  setPostAttachments: Dispatch<SetStateAction<MediaAttachment[]>>
  mediaUploading: 'chat' | 'feed' | 'story' | 'profile' | null
  uploadProgress?: { loaded: number; total: number } | null
  cancelUpload?: () => void
  showPostBackgrounds: boolean
  setShowPostBackgrounds: Dispatch<SetStateAction<boolean>>
  postVisibility: 'public' | 'friends' | 'private'
  setPostVisibility: (visibility: 'public' | 'friends' | 'private') => void
  setPostBackground: (background: string) => void
}

export default function PostComposer({
  name, popup = false, editingPost, editBusy = false, displayName, submitError,
  checkInOpen = false, checkInLocation = '', setCheckInLocation, setCheckInOpen,
  createPost, postComposerRef, postBackground, pendingPost, postText, setPostText,
  taggableFriends, taggedFriends, setTaggedFriends, feelingId, setFeelingId,
  feedAlbumInputRef, addFeedFiles,
  postAttachments, setPostAttachments, mediaUploading, uploadProgress, cancelUpload,
  showPostBackgrounds, setShowPostBackgrounds, postVisibility, setPostVisibility, setPostBackground,
}: Props) {
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [feelingPickerOpen, setFeelingPickerOpen] = useState(false)
  type ComposerTool = 'media' | 'background' | 'tag' | 'feeling' | 'checkin'
  const [activeTool, setActiveTool] = useState<ComposerTool | null>(
    checkInOpen ? 'checkin' : showPostBackgrounds ? 'background' : null
  )
  // Keep previously chosen post metadata, but show only one tool panel.
  const selectTool = (tool: ComposerTool) => {
    const next = activeTool === tool ? null : tool
    setActiveTool(next)
    setShowPostBackgrounds(next === 'background')
    setTagPickerOpen(next === 'tag')
    setFeelingPickerOpen(next === 'feeling')
    if (next === 'tag') setTagQuery('')
    if (next === 'checkin' && !checkInOpen) setCheckInOpen?.(true)
    // An unfilled check-in is only a draft panel, not a pending required field.
    // Keep an existing location when switching so the post does not lose it.
    if (next !== 'checkin' && checkInOpen && !checkInLocation.trim()) {
      setCheckInOpen?.(false)
    }
  }
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

  const location = checkInOpen ? checkInLocation.trim() : ''
  const locationPrefix = location ? `📍 ${location}\n` : ''
  const taggedPeopleText = taggedFriends.length
    ? `👥 Cùng với ${taggedFriends.map(friend => `@${friend.username}`).join(', ')}\n`
    : ''
  const feelingText = feelingPostLine(feelingId)
  const contentLength = Array.from([locationPrefix.trimEnd(), taggedPeopleText.trimEnd(), feelingText, postText.trim()]
    .filter(Boolean).join('\n')).length
  const overLimit = contentLength > 5000
  const isPosting = !!pendingPost || editBusy || mediaUploading === 'feed'
  const postAudience = <PostAudiencePicker value={postVisibility} disabled={isPosting} onChange={setPostVisibility} />

  return (
    <form className={`post-box zalo-post-composer smart-post-composer ${popup ? 'profile-popup-composer' : ''}`} onSubmit={createPost}>
      <div className="post-prompt compact-post-prompt">
        <UserAvatar username={name} name={userLabel(displayName, name)} className="avatar self-avatar" />
        {popup && <div className="profile-post-author">
          <strong>{displayName || name}</strong>
          {postAudience}
        </div>}
        <textarea ref={postComposerRef}
          className={postBackground ? 'feed-composer-bg bg-' + postBackground : ''}
          disabled={isPosting}
          aria-label="Nội dung bài viết"
          placeholder="Bạn đang nghĩ gì?"
          value={postText}
          onChange={event => setPostText(event.target.value)}
          rows={1}
          maxLength={5000}
        />
      </div>
      <input ref={feedAlbumInputRef} className="hidden-media-input" type="file" accept="image/*,video/*" multiple
        aria-label="Chọn ảnh hoặc video cho bài viết"
        onChange={event => {
          const files = Array.from(event.currentTarget.files || [])
          event.currentTarget.value = ''
          void addFeedFiles(files)
        }} />
      {activeTool === 'checkin' && checkInOpen && setCheckInLocation && (
        <label className="social-feed-checkin-field">
          <span className="smart-checkin-heading">
            <strong><MapPin size={16} aria-hidden="true" /> Check-in tại</strong>
            <button type="button" aria-label="Bỏ check-in" disabled={isPosting}
              onClick={() => { setCheckInOpen?.(false); setCheckInLocation(''); setActiveTool(null) }}><X size={17} aria-hidden="true" /></button>
          </span>
          <input type="text" aria-label="Địa điểm check-in" value={checkInLocation} maxLength={120}
            onChange={event => setCheckInLocation(event.target.value)}
            placeholder="Bạn đang ở đâu?" disabled={isPosting} required />
          <small>Địa điểm sẽ xuất hiện trong bài viết của bạn.</small>
        </label>
      )}
      {activeTool === 'tag' && (tagPickerOpen || taggedFriends.length > 0) && (
        <PostTagPicker
          tagPickerOpen={tagPickerOpen}
          tagQuery={tagQuery}
          setTagQuery={setTagQuery}
          taggableFriends={taggableFriends}
          taggedFriends={taggedFriends}
          setTaggedFriends={setTaggedFriends}
          disabled={isPosting}
          onClose={() => { setTagPickerOpen(false); setTagQuery(''); setActiveTool(null) }}
        />
      )}
      {activeTool === 'feeling' && (feelingPickerOpen || feelingId) && (
        <PostFeelingPicker
          feelingPickerOpen={feelingPickerOpen}
          feelingId={feelingId}
          disabled={isPosting}
          onClose={() => { setFeelingPickerOpen(false); setActiveTool(null) }}
          onClear={() => { setFeelingId(''); setActiveTool(null) }}
          onSelect={id => { setFeelingId(id); setFeelingPickerOpen(false) }}
        />
      )}
      {postAttachments.length > 0 && (
        <div className="feed-pending-media">
          <MediaAttachmentsView items={postAttachments} pending={!editingPost}
            onRemove={isPosting || !!editingPost ? undefined : index => setPostAttachments(current => current.filter((_, i) => i !== index))} />
          {editingPost && <small className="smart-composer-hint">Ảnh/video đã đăng được giữ nguyên khi sửa bài viết.</small>}
        </div>
      )}
      {mediaUploading === 'feed' && uploadProgress && (
        <div className="smart-upload-progress" role="status" aria-live="polite">
          <span>Đang tải ảnh/video · {Math.round(100 * uploadProgress.loaded / Math.max(uploadProgress.total, 1))}%</span>
          <progress aria-label="Tiến độ tải ảnh/video" max={uploadProgress.total} value={uploadProgress.loaded} />
          {cancelUpload && <button type="button" onClick={cancelUpload}>Hủy tải</button>}
        </div>
      )}
      <div className="composer-shortcuts smart-composer-actions" role="group" aria-label="Thêm vào bài viết">
        <span className="smart-composer-actions-title">Thêm vào bài viết</span>
        <div className="smart-composer-action-icons">
          <button type="button" disabled={isPosting || !!editingPost} data-tooltip={editingPost ? 'Không thể thay đổi ảnh/video trong bài đã đăng' : 'Thêm ảnh hoặc video'} aria-label="Thêm ảnh hoặc video"
            onClick={() => { selectTool('media'); feedAlbumInputRef.current?.click() }}><ImageIcon size={21} aria-hidden="true" /></button>
          <button type="button" disabled={isPosting} data-tooltip="Chọn nền chữ" aria-label="Nền chữ"
            aria-expanded={showPostBackgrounds} aria-pressed={showPostBackgrounds}
            onClick={() => { selectTool('background'); postComposerRef.current?.focus() }}>
            <Palette size={21} aria-hidden="true" />
          </button>
          <button type="button" disabled={isPosting} data-tooltip="Gắn thẻ bạn bè" aria-label="Gắn thẻ bạn bè"
            aria-expanded={tagPickerOpen} aria-pressed={taggedFriends.length > 0}
            onClick={() => selectTool('tag')}>
            <UserRoundPlus size={21} aria-hidden="true" />
          </button>
          <button type="button" disabled={isPosting} data-tooltip="Bạn đang cảm thấy thế nào?" aria-label="Cảm xúc"
            aria-expanded={feelingPickerOpen} aria-pressed={Boolean(feelingId)}
            onClick={() => selectTool('feeling')}><SmilePlus size={21} aria-hidden="true" /></button>
          {setCheckInOpen && <button type="button" disabled={isPosting} data-tooltip="Thêm địa điểm check-in" aria-label="Check-in địa điểm"
            aria-expanded={activeTool === 'checkin' && checkInOpen} aria-pressed={checkInOpen && !!checkInLocation.trim()}
            onClick={() => selectTool('checkin')}><MapPin size={21} aria-hidden="true" /></button>}
        </div>
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
      {contentLength > 4500 && <p className="smart-composer-count" aria-live="polite">{contentLength} / 5.000 ký tự</p>}
      {overLimit && <p className="smart-composer-error" role="alert">Nội dung, địa điểm, cảm xúc và gắn thẻ vượt quá 5.000 ký tự.</p>}
      {checkInOpen && !location && <p className="smart-composer-hint">Nhập địa điểm để đăng bài check-in.</p>}
      {submitError && <p className="profile-post-error" role="alert">{submitError}</p>}
      {(popup || postText.trim() || postAttachments.length > 0 || checkInOpen || taggedFriends.length > 0 || feelingId) && (
        <button className="feed-submit" disabled={isPosting || !!mediaUploading || overLimit || (checkInOpen && !location) ||
          (!postText.trim() && postAttachments.length === 0 && !location && taggedFriends.length === 0 && !feelingId)}>{editingPost ? 'Lưu thay đổi' : 'Đăng'}</button>
      )}
    </form>
  )
}
