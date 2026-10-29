import { userLabel } from '../../shared/lib/userLabel'
import { useEffect, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'

export type FeedComment = {
  id: number
  parentId?: number | null
  author: string
  authorDisplayName?: string
  content: string
  createdAt: string
  updatedAt?: string | null
}

type TranslationProps = { api: string; token: string; target: string }
export type DiscussionDraft = { replyTo: FeedComment | null; drafts: Record<number, string>; sending?: boolean; error?: string }
const translationCache = new Map<string, string>()

export function FeedText({ text, api, token, target, maxLines, onExpand }: TranslationProps & {
  text: string
  maxLines?: number
  onExpand?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const key = JSON.stringify([api, token, target, text])
  const [result, setResult] = useState({ key: '', text: '' })
  const translated = result.key === key ? result.text : ''
  const [original, setOriginal] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(false)

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
    setResult({ key, text: '' })
    setOriginal(false)
    setExpanded(false)
    setFailed(false)
    if (!visible || !text.trim() || !target) return
    const cached = translationCache.get(key)
    if (cached) {
      setResult({ key, text: cached })
      return
    }
    const controller = new AbortController()
    let retry: ReturnType<typeof setTimeout> | undefined
    async function translate(attempt = 0) {
      try {
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
        setResult({ key, text: result.translatedText })
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
  }, [api, token, target, text, visible, key])

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

export function FeedDiscussion({ comments, pending, submit, editor, updateEditor, currentUser, onEdit, onDelete, onReport, ...translation }: TranslationProps & {
  comments: FeedComment[]
  pending?: FeedComment
  submit: (content: string, parentId?: number) => Promise<void>
  editor: DiscussionDraft
  updateEditor: (value: DiscussionDraft) => void
  currentUser: string
  onEdit: (id: number, content: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onReport: (id: number, reason: string) => Promise<void>
}) {
  const { replyTo, drafts } = editor
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set())
  const [editingComment, setEditingComment] = useState<number | null>(null)
  const [commentOptionsId, setCommentOptionsId] = useState<number | null>(null)
  useEffect(() => {
    if (commentOptionsId === null) return
    function onDismiss(event: PointerEvent) {
      if (!(event.target as HTMLElement).closest('.feed-comment-menu')) setCommentOptionsId(null)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setCommentOptionsId(null)
    }
    document.addEventListener('pointerdown', onDismiss)
    document.addEventListener('keydown', onEscape)
    return () => {
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
    return (
      <div className="feed-comment-row">
        <span className="feed-comment-avatar" aria-hidden="true">{userLabel(comment.authorDisplayName, comment.author).slice(0, 2).toUpperCase()}</span>
        <div className="feed-comment-body">
          <div className="feed-comment-bubble">
            <strong>{userLabel(comment.authorDisplayName, comment.author)}</strong>
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
            <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
            <button type="button" disabled={sending} onClick={() => reply(comment)} aria-label={`Trả lời ${userLabel(comment.authorDisplayName, comment.author)}`}>Trả lời</button>
            <div className="feed-comment-menu">
              <button type="button" aria-label="Tùy chọn bình luận" aria-expanded={commentOptionsId === comment.id}
                onClick={() => setCommentOptionsId(current => current === comment.id ? null : comment.id)}>
                <Ellipsis size={16} />
              </button>
              {commentOptionsId === comment.id && (
                <div className="feed-comment-options" role="group" aria-label="Thao tác bình luận">
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
                </div>
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

  return (
    <section className="feed-discussion" aria-label="Bình luận">
      <ul className="feed-comment-threads">
        {[...threads].map(([root, [first, ...replies]]) => (
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
      {commentActionError && <p role="alert" className="feed-comment-error">{commentActionError}</p>}
      {pending && (
        <div className="feed-comment-row outgoing-preview" aria-busy="true">
          <span className="feed-comment-avatar" aria-hidden="true">{userLabel(pending.authorDisplayName, pending.author).slice(0, 2).toUpperCase()}</span>
          <div className="feed-comment-body">
            <div className="feed-comment-bubble">
              <strong>{userLabel(pending.authorDisplayName, pending.author)}</strong>
              {pending.parentId && <small className="feed-reply-to">Trả lời {userLabel(byID.get(pending.parentId)?.authorDisplayName, byID.get(pending.parentId)?.author)}</small>}
              <p className="pending-content">{pending.content}</p>
            </div>
            <small role="status">Đang gửi bình luận...</small>
          </div>
        </div>
      )}
      <form className="feed-comment-form" onSubmit={(event) => { event.preventDefault(); void send() }}>
        {replyTo && (
          <div className="feed-reply-target">
            <span>Đang trả lời {userLabel(replyTo.authorDisplayName, replyTo.author)}</span>
            <button type="button" disabled={sending} onClick={() => updateEditor({ drafts, replyTo: null })}>Hủy</button>
          </div>
        )}
        <div className="feed-comment-compose">
          <textarea ref={input} rows={2} maxLength={1000} disabled={sending}
            aria-label={replyTo ? `Phản hồi ${userLabel(replyTo.authorDisplayName, replyTo.author)}` : 'Viết bình luận'}
            placeholder={replyTo ? `Trả lời ${userLabel(replyTo.authorDisplayName, replyTo.author)}...` : 'Viết bình luận...'}
            value={draft} onChange={(event) => updateEditor({ replyTo, drafts: { ...drafts, [draftKey]: event.target.value } })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send()
              }
            }} />
          <button type="submit" disabled={sending || !draft.trim()} aria-label={sending ? 'Đang gửi bình luận' : 'Gửi bình luận'}>
            {sending ? '…' : 'Gửi'}
          </button>
        </div>
        {error && <p role="alert" className="feed-comment-error">{error}</p>}
      </form>
    </section>
  )
}