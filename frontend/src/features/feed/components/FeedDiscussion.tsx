import { userLabel } from '../../../shared/utils/userLabel'
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ModalPortalContext } from '../../../shared/ui/modalPortalContext'
import { CommentComposerTarget } from './commentComposerTarget'
import { createPortal } from 'react-dom'
import { Ellipsis, Heart, SendHorizontal } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { useScopedState } from '../../../shared/hooks/useScopedState'

export type FeedComment = {
  id: number
  parentId?: number | null
  liked?: boolean
  author: string
  authorDisplayName?: string
  content: string
  createdAt: string
  updatedAt?: string | null
}

type TranslationProps = { api: string; token: string; target: string }
export type DiscussionDraft = { replyTo: FeedComment | null; drafts: Record<number, string>; sending?: boolean; error?: string }
const translationCache = new Map<string, string>()

function commentRelativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000))
  if (!Number.isFinite(minutes)) return new Date(value).toLocaleDateString('vi-VN')
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} ngày trước`
  return new Date(value).toLocaleDateString('vi-VN')
}

export function FeedText({ text, api, token, target, maxLines, onExpand }: TranslationProps & {
  text: string
  maxLines?: number
  onExpand?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const key = JSON.stringify([api, token, target, text])
  const [fetched, setFetched] = useScopedState(key, '')
  const [original, setOriginal] = useScopedState(key, false)
  const [expanded, setExpanded] = useScopedState(key, false)
  const [failed, setFailed] = useScopedState(key, false)
  const [visible, setVisible] = useState(false)
  const wanted = visible && Boolean(text.trim()) && Boolean(target)
  const cached = useMemo(() => wanted ? translationCache.get(key) : undefined, [wanted, key])
  const translated = fetched || cached || ''

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    })
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!wanted || cached) return
    const controller = new AbortController()
    let retry: ReturnType<typeof setTimeout> | undefined
    async function translate(attempt = 0) {
      try {
        // Another instance with the same text may have filled the cache since this render.
        const hit = translationCache.get(key)
        if (hit) {
          await Promise.resolve()
          if (!controller.signal.aborted) setFetched(hit)
          return
        }
        const response = await fetch(`${api}/api/translate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, target }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Translation unavailable')
        const result = await response.json() as { translatedText?: string }
        if (!result.translatedText?.trim()) throw new Error('Empty translation')
        if (controller.signal.aborted) return
        if (translationCache.size >= 200) translationCache.delete(translationCache.keys().next().value!)
        translationCache.set(key, result.translatedText)
        setFetched(result.translatedText)
      } catch {
        if (controller.signal.aborted) return
        if (attempt < 2) retry = setTimeout(() => void translate(attempt + 1), 2000 * (attempt + 1))
        else setFailed(true)
      }
    }
    void translate()
    return () => {
      controller.abort()
      clearTimeout(retry)
    }
  }, [api, token, target, text, wanted, cached, key, setFetched, setFailed])

  const visibleText = translated && !original ? translated : text
  const isLong = Boolean(maxLines && (
    visibleText.length > maxLines * 70 ||
    visibleText.split('\n').length > maxLines
  ))
  const clamped = Boolean(maxLines && !expanded)

  return (
    <div ref={host} className="feed-text">
      <p className={clamped ? 'feed-text-clamped' : ''} style={clamped ? { WebkitLineClamp: maxLines } : undefined}>
        {visibleText}
      </p>
      {isLong && clamped && (
        <button
          type="button"
          className="feed-text-more"
          onClick={() => onExpand ? onExpand() : setExpanded(true)}
        >
          Xem thêm
        </button>
      )}
      {translated && translated !== text && (
        <button type="button" className="feed-text-toggle" onClick={() => setOriginal(!original)}>
          {original ? 'Xem bản dịch' : 'Xem bản gốc'}
        </button>
      )}
      {failed && <small className="feed-translation-error">Chưa dịch được. Đang hiển thị bản gốc.</small>}
    </div>
  )
}

export function FeedDiscussion({ comments, pending, submit, editor, updateEditor, currentUser, onEdit, onDelete, onReport, onLike, onAuthorOpen, variant = 'default', sortOrder = 'oldest', showComments = true, ...translation }: TranslationProps & {
  comments: FeedComment[]
  pending?: FeedComment
  submit: (content: string, parentId?: number) => Promise<void>
  editor: DiscussionDraft
  updateEditor: (value: DiscussionDraft) => void
  currentUser: string
  onEdit: (id: number, content: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onReport: (id: number, reason: string) => Promise<void>
  onLike?: (id: number, liked: boolean) => Promise<void>
  onAuthorOpen: (username: string) => void
  variant?: 'default' | 'post-page'
  sortOrder?: 'oldest' | 'newest'
  showComments?: boolean
}) {
  const composerTarget = useContext(CommentComposerTarget)
  const modalContainer = useContext(ModalPortalContext)
  const { replyTo, drafts } = editor
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set())
  const [editingComment, setEditingComment] = useState<number | null>(null)
  const [commentOptionsId, setCommentOptionsId] = useState<number | null>(null)
  const optionsTrigger = useRef<HTMLButtonElement | null>(null)
  const optionsPanel = useRef<HTMLDivElement>(null)
  const [optionsPosition, setOptionsPosition] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (commentOptionsId === null) return
    const anchor = optionsTrigger.current?.getBoundingClientRect()
    const panel = optionsPanel.current?.getBoundingClientRect()
    if (!anchor || !panel) return
    const below = anchor.bottom + 4
    const top = below + panel.height <= window.innerHeight - 8 ? below : anchor.top - panel.height - 4
    setOptionsPosition({
      top: Math.max(8, Math.min(top, window.innerHeight - panel.height - 8)),
      left: Math.max(8, Math.min(anchor.left, document.documentElement.clientWidth - panel.width - 8)),
    })
  }, [commentOptionsId])
  useEffect(() => {
    if (commentOptionsId === null) return
    function onDismiss(event: PointerEvent) {
      if (!optionsPanel.current?.contains(event.target as Node) && !optionsTrigger.current?.contains(event.target as Node)) setCommentOptionsId(null)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setCommentOptionsId(null)
        optionsTrigger.current?.focus()
      }
    }
    const onMove = () => setCommentOptionsId(null)
    window.addEventListener('resize', onMove)
    document.addEventListener('scroll', onMove, true)
    document.addEventListener('pointerdown', onDismiss)
    document.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('resize', onMove)
      document.removeEventListener('scroll', onMove, true)
      document.removeEventListener('pointerdown', onDismiss)
      document.removeEventListener('keydown', onEscape)
    }
  }, [commentOptionsId])
  const [editingText, setEditingText] = useState('')
  const [reportingComment, setReportingComment] = useState<number | null>(null)
  const [reportReason, setReportReason] = useState('Nội dung spam')
  const [commentActionBusy, setCommentActionBusy] = useState(false)
  const [commentActionError, setCommentActionError] = useState('')
  async function runAction(action: () => Promise<void>) {
    if (commentActionBusy) return
    setCommentActionBusy(true)
    setCommentActionError('')
    try { await action() }
    catch (error) { setCommentActionError(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.') }
    finally { setCommentActionBusy(false) }
  }
  const sending = editor.sending ?? false
  const error = editor.error || ''
  const busy = useRef(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const draftKey = replyTo?.id ?? 0
  const draft = drafts[draftKey] || ''
  const byID = new Map(comments.map((comment) => [comment.id, comment]))
  const rootByID = new Map<number, number>()
  const threads = new Map<number, FeedComment[]>()
  // ponytail: one visual indent keeps deep replies readable; parentId preserves the full tree.
  for (const comment of [...comments].sort((a, b) => a.id - b.id)) {
    const root = (comment.parentId && rootByID.get(comment.parentId)) || comment.id
    rootByID.set(comment.id, root)
    if (!threads.has(root)) threads.set(root, [])
    threads.get(root)!.push(comment)
  }

  const orderedThreads = [...threads].sort(([a, aComments], [b, bComments]) => {
    const dateDiff = Date.parse(aComments[0]?.createdAt || '') - Date.parse(bComments[0]?.createdAt || '')
    return (sortOrder === 'newest' ? -1 : 1) * (Number.isFinite(dateDiff) && dateDiff !== 0 ? dateDiff : a - b)
  })

  function reply(comment: FeedComment) {
    updateEditor({ drafts, replyTo: comment })
    input.current?.focus()
  }

  async function send() {
    if (!draft.trim() || busy.current || sending) return
    busy.current = true
    updateEditor({ ...editor, sending: true, error: '' })
    try {
      await submit(draft.trim(), replyTo?.id)
      updateEditor({ drafts: { ...drafts, [draftKey]: '' }, replyTo: null })
      const root = replyTo && rootByID.get(replyTo.id)
      if (root) setExpandedThreads((current) => new Set([...current, root]))
    } catch (cause) {
      updateEditor({ ...editor, sending: false,
        error: cause instanceof Error ? cause.message : 'Không gửi được bình luận. Bản nháp được giữ lại.' })
    } finally {
      busy.current = false
    }
  }

  function renderComment(comment: FeedComment) {
    const parent = comment.parentId ? byID.get(comment.parentId) : undefined
    const authorName = userLabel(comment.authorDisplayName, comment.author)
    return (
      <div className="feed-comment-row">
        {variant === 'post-page'
          ? <UserAvatar username={comment.author} name={authorName} className="feed-comment-avatar" />
          : <span className="feed-comment-avatar" aria-hidden="true">{authorName.slice(0, 2).toUpperCase()}</span>}
        <div className="feed-comment-body">
          <div className="feed-comment-bubble">
            <strong>
              {comment.author ? (
                <button type="button" className="visitor-name-link" onClick={() => onAuthorOpen(comment.author)}>{authorName}</button>
              ) : authorName}
            </strong>
            {parent && <small className="feed-reply-to">Trả lời {userLabel(parent.authorDisplayName, parent.author)}</small>}
            {editingComment === comment.id ? (
              <div className="feed-comment-edit">
                <textarea maxLength={1000} rows={3} value={editingText} onChange={event => setEditingText(event.target.value)} aria-label="Chỉnh sửa bình luận" />
                <div>
                  <button type="button" onClick={() => setEditingComment(null)}>Hủy</button>
                  <button type="button" disabled={commentActionBusy || !editingText.trim()} onClick={() => void runAction(async () => {
                    await onEdit(comment.id, editingText.trim()); setEditingComment(null)
                  })}>Lưu</button>
                </div>
              </div>
            ) : <FeedText {...translation} text={comment.content} maxLines={3} />}
          </div>
          <div className="feed-comment-actions">
            {variant === 'default' && <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}
            {variant === 'post-page' && onLike && comment.id > 0 && <>
              <button type="button" className={comment.liked ? 'feed-comment-liked' : ''}
                aria-pressed={Boolean(comment.liked)} disabled={commentActionBusy}
                onClick={() => void runAction(() => onLike(comment.id, !comment.liked))}>
                <Heart size={14} fill={comment.liked ? 'currentColor' : 'none'} aria-hidden="true" />
                {comment.liked ? 'Đã thích' : 'Thích'}
              </button>
              <span aria-hidden="true">·</span>
            </>}
            <button type="button" disabled={sending} onClick={() => reply(comment)} aria-label={`Trả lời ${authorName}`}>Trả lời</button>
            {variant === 'post-page' && <span aria-hidden="true">·</span>}
            {variant === 'post-page' && <time dateTime={comment.createdAt}>{commentRelativeTime(comment.createdAt)}</time>}
            <div className="feed-comment-menu">
              <button type="button" aria-label="Tùy chọn bình luận" aria-expanded={commentOptionsId === comment.id}
                onClick={event => { optionsTrigger.current = event.currentTarget; setCommentOptionsId(current => current === comment.id ? null : comment.id) }}>
                <Ellipsis size={16} />
              </button>
              {commentOptionsId === comment.id && createPortal(
                <div ref={optionsPanel} style={optionsPosition} className="feed-comment-options" role="group" aria-label="Thao tác bình luận">
                  {comment.author === currentUser ? (
                    <>
                      <button type="button" disabled={commentActionBusy} onClick={() => {
                        setEditingComment(comment.id); setEditingText(comment.content); setReportingComment(null); setCommentOptionsId(null)
                      }}>Chỉnh sửa bình luận</button>
                      <button type="button" className="danger" disabled={commentActionBusy} onClick={() => {
                        setCommentOptionsId(null)
                        if (window.confirm('Xóa bình luận và các phản hồi bên dưới?')) void runAction(() => onDelete(comment.id))
                      }}>Xóa bình luận</button>
                    </>
                  ) : <button type="button" onClick={() => {
                    setReportingComment(comment.id); setEditingComment(null); setCommentOptionsId(null)
                  }}>Báo cáo bình luận</button>}
                </div>, modalContainer ?? document.body
              )}
            </div>
          </div>
          {reportingComment === comment.id && <div className="feed-comment-edit">
            <select aria-label="Lý do báo cáo bình luận" value={reportReason} onChange={event => setReportReason(event.target.value)}>
              {['Nội dung spam','Quấy rối hoặc xúc phạm','Lừa đảo hoặc giả mạo','Nội dung không phù hợp'].map(reason => <option key={reason}>{reason}</option>)}
            </select>
            <div><button type="button" onClick={() => setReportingComment(null)}>Hủy</button>
              <button type="button" disabled={commentActionBusy} onClick={() => void runAction(async () => {
                await onReport(comment.id, reportReason); setReportingComment(null)
              })}>Gửi báo cáo</button></div>
          </div>}
        </div>
      </div>
    )
  }

  const composer = (
      <form className="feed-comment-form" onSubmit={(event) => { event.preventDefault(); void send() }}>
        {replyTo && (
          <div className="feed-reply-target">
            <span>Đang trả lời {userLabel(replyTo.authorDisplayName, replyTo.author)}</span>
            <button type="button" disabled={sending} onClick={() => updateEditor({ drafts, replyTo: null })}>Hủy</button>
          </div>
        )}
        <div className="feed-comment-compose">
          {variant === 'post-page' && <UserAvatar username={currentUser} name={currentUser} className="feed-comment-composer-avatar" />}
          <textarea ref={input} rows={variant === 'post-page' ? 1 : 2} maxLength={1000} disabled={sending}
            aria-label={replyTo ? `Phản hồi ${userLabel(replyTo.authorDisplayName, replyTo.author)}` : 'Viết bình luận'}
            placeholder={replyTo ? `Trả lời ${userLabel(replyTo.authorDisplayName, replyTo.author)}...` : 'Viết bình luận...'}
            value={draft} onChange={(event) => updateEditor({ replyTo, drafts: { ...drafts, [draftKey]: event.target.value } })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send()
              }
            }} />
          <button type="submit" disabled={sending || !draft.trim()} aria-label="Gửi bình luận">
            {variant === 'post-page' ? <SendHorizontal size={21} aria-hidden="true" /> : 'Gửi'}
          </button>
        </div>
        {error && <p role="alert" className="feed-comment-error">{error}</p>}
      </form>
  )

  return (
    <section className="feed-discussion" aria-label="Bình luận">
      {showComments && (
        <>
          <ul className="feed-comment-threads">
            {orderedThreads.map(([root, [first, ...replies]]) => (
              <li key={root}>
                {renderComment(first)}
                {replies.length > 0 && (
                  <>
                    <button type="button" className="feed-replies-toggle" aria-expanded={expandedThreads.has(root)}
                      onClick={() => setExpandedThreads((current) => {
                        const next = new Set(current)
                        if (next.has(root)) next.delete(root)
                        else next.add(root)
                        return next
                      })}>
                      {expandedThreads.has(root) ? `Ẩn ${replies.length} phản hồi` : `Xem ${replies.length} phản hồi`}
                    </button>
                    {expandedThreads.has(root) && (
                      <ul className="feed-comment-replies">
                        {replies.map((comment) => <li key={comment.id}>{renderComment(comment)}</li>)}
                      </ul>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {pending && (
            <div className="feed-comment-row outgoing-preview" aria-busy="true">
              {variant === 'post-page'
                ? <UserAvatar username={pending.author} name={userLabel(pending.authorDisplayName, pending.author)} className="feed-comment-avatar" />
                : <span className="feed-comment-avatar" aria-hidden="true">{userLabel(pending.authorDisplayName, pending.author).slice(0, 2).toUpperCase()}</span>}
              <div className="feed-comment-body">
                <div className="feed-comment-bubble">
                  <strong>{userLabel(pending.authorDisplayName, pending.author)}</strong>
                  {pending.parentId && <small className="feed-reply-to">Trả lời {userLabel(byID.get(pending.parentId)?.authorDisplayName, byID.get(pending.parentId)?.author)}</small>}
                  <p className="pending-content">{pending.content}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {commentActionError && <p role="alert" className="feed-comment-error">{commentActionError}</p>}
      {composerTarget ? createPortal(composer, composerTarget) : composer}
    </section>
  )
}
