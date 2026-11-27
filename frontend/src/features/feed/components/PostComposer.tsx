import { useUiTranslation } from '@/shared/i18n/locale'
import { lazy, Suspense, useLayoutEffect, useState } from 'react'
import { checkInDisplayName, formatMapCheckIn } from '../utils/publicPostLocation'
const PostMapPicker = lazy(() => import('./PostMapPicker'))
import { MapPin, X } from 'lucide-react'
import FeedComposerIconButton from './FeedComposerIconButton'
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
  const trUi = useUiTranslation()

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
          aria-label={trUi("feed.postContent")}
          placeholder={trUi("feed.whatThinking")}
          value={postText}
          onChange={event => setPostText(event.target.value)}
          rows={1}
          maxLength={5000}
        />
      </div>
      <input ref={feedAlbumInputRef} className="hidden-media-input" type="file" accept="image/*,video/*" multiple
        aria-label={trUi("common.ui.choosePostMedia")}
        onChange={event => {
          const files = Array.from(event.currentTarget.files || [])
          event.currentTarget.value = ''
          void addFeedFiles(files)
        }} />
      {activeTool === 'checkin' && checkInOpen && setCheckInLocation && (
        <div className="social-feed-checkin-field">
          <span className="smart-checkin-heading">
            <strong><MapPin size={16} aria-hidden="true" />{trUi("common.ui.tagLocation")}</strong>
            <button type="button" aria-label={trUi("common.ui.removeCheckin")} disabled={isPosting}
              onClick={() => { setCheckInOpen?.(false); setCheckInLocation(''); setActiveTool(null) }}><X size={17} aria-hidden="true" /></button>
          </span>
          {postVisibility === 'public' ? <input type="text" aria-label={trUi("common.ui.checkinPlace")} value={checkInDisplayName(checkInLocation)} maxLength={120}
            onChange={event => setCheckInLocation(event.target.value)}
            placeholder={trUi("common.ui.placeName")} disabled={isPosting} required /> :
            <Suspense fallback={<small>{trUi("discover.loadingMap")}</small>}><PostMapPicker value={checkInLocation} disabled={isPosting} onConfirm={pin => { setCheckInLocation(formatMapCheckIn(pin)); setActiveTool(null) }} /></Suspense>}
          <small>{postVisibility === "public" ? trUi("feed.publicGpsHint") : trUi("feed.privateGpsHint")}</small>
          {location && <span className="flex min-w-0 max-w-full items-start gap-1 text-xs font-medium text-neutral-600"><MapPin size={14} className="mt-1 shrink-0 text-neutral-500" aria-hidden="true" /><span className="min-w-0 rounded-md bg-neutral-100 px-1.5 py-0.5 line-clamp-2 [overflow-wrap:anywhere]" title={checkInDisplayName(location)}>{checkInDisplayName(location)}</span></span>}
        </div>
      )}
      {activeTool !== 'checkin' && location && <div className="flex min-w-0 max-w-full items-center gap-2 text-sm"><MapPin size={15} className="shrink-0 text-neutral-500" aria-hidden="true" /><span className="min-w-0 max-w-full rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-600 line-clamp-2 [overflow-wrap:anywhere]" title={checkInDisplayName(location)}>{checkInDisplayName(location)}</span><button type="button" className="shrink-0" disabled={isPosting} aria-label={trUi("common.ui.removeLocation")} onClick={() => { setCheckInLocation?.(''); setCheckInOpen?.(false) }}><X size={16} /></button></div>}
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
          {editingPost && <small className="smart-composer-hint">{trUi('feed.editMediaHint')}</small>}
        </div>
      )}
      {mediaUploading === 'feed' && uploadProgress && (
        <div className="smart-upload-progress" role="status" aria-live="polite">
          <span>{trUi('feed.uploadingMedia', { percent: Math.round(100 * uploadProgress.loaded / Math.max(uploadProgress.total, 1)) })}</span>
          <progress aria-label={trUi("common.ui.mediaProgress")} max={uploadProgress.total} value={uploadProgress.loaded} />
          {cancelUpload && <button type="button" onClick={cancelUpload}>{trUi("common.cancelUpload")}</button>}
        </div>
      )}
      <div className="composer-shortcuts smart-composer-actions" role="group" aria-label={trUi("feed.addToPost")}>
        <span className="smart-composer-actions-title">{trUi("feed.addToPost")}</span>
        <div className="smart-composer-action-icons">
          <FeedComposerIconButton icon="photo" disabled={isPosting || !!editingPost} data-tooltip={editingPost ? trUi("common.ui.editMediaDisabled") : trUi("feed.addMedia")} aria-label={trUi("feed.addMedia")}
            onClick={() => { selectTool('media'); feedAlbumInputRef.current?.click() }} />
          <FeedComposerIconButton icon="background" disabled={isPosting} data-tooltip={trUi("common.ui.chooseTextBackground")} aria-label={trUi("common.ui.textBackground")}
            aria-expanded={showPostBackgrounds} aria-pressed={showPostBackgrounds}
            onClick={() => { selectTool('background'); postComposerRef.current?.focus() }} />
          <FeedComposerIconButton icon="tag" disabled={isPosting} data-tooltip={trUi("feed.tagFriends")} aria-label={trUi("feed.tagFriends")}
            aria-expanded={tagPickerOpen} aria-pressed={taggedFriends.length > 0}
            onClick={() => selectTool('tag')} />
          <FeedComposerIconButton icon="feeling" disabled={isPosting} data-tooltip={trUi("common.ui.feelingPrompt")} aria-label={trUi("common.ui.feeling")}
            aria-expanded={feelingPickerOpen} aria-pressed={Boolean(feelingId)}
            onClick={() => selectTool('feeling')} />
          {setCheckInOpen && <FeedComposerIconButton icon="location" disabled={isPosting} data-tooltip={trUi("common.ui.tagLocation")} aria-label={trUi("common.ui.checkIn")}
            aria-expanded={activeTool === 'checkin' && checkInOpen} aria-pressed={checkInOpen && !!checkInLocation.trim()}
            onClick={() => selectTool('checkin')} />}
        </div>
      </div>
      <div className="feed-composer-settings">
        {!popup && postAudience}
        {showPostBackgrounds && <div className="feed-background-palette" aria-label={trUi("common.ui.choosePostBackground")}>
          {(['', 'violet', 'blue', 'sunset', 'mint', 'night'] as const).map(bg => (
            <button key={bg || 'none'} type="button" className={'feed-palette-dot bg-' + (bg || 'none')}
              aria-pressed={postBackground === bg} aria-label={bg ? trUi(`feed.background.${bg}`) : trUi("common.ui.noBackground")} onClick={() => setPostBackground(bg)}>
              {postBackground === bg ? '✓' : ''}
            </button>
          ))}
        </div>}
      </div>
      {contentLength > 4500 && <p className="smart-composer-count" aria-live="polite">{trUi('feed.characterCount', { count: contentLength, limit: 5000 })}</p>}
      {overLimit && <p className="smart-composer-error" role="alert">{trUi('feed.contentLimit')}</p>}
      {checkInOpen && !location && <p className="smart-composer-hint">{trUi('feed.selectLocationHint')}</p>}
       {submitError && <p className="profile-post-error" role="alert">{submitError}</p>}
      {(popup || postText.trim() || postAttachments.length > 0 || checkInOpen || taggedFriends.length > 0 || feelingId) && (
        <button className="feed-submit" disabled={isPosting || !!mediaUploading || overLimit || (checkInOpen && !location) ||
          (!postText.trim() && postAttachments.length === 0 && !location && taggedFriends.length === 0 && !feelingId)}>{isPosting ? trUi("common.processing") : editingPost ? trUi("common.saveChanges") : trUi('feed.publishShort')}</button>
      )}
    </form>
  )
}