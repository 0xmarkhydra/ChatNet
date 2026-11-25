import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ModalPortalContext } from '../../../shared/ui/modalPortalContext'
import { postShareUrl } from '../utils/postSharing'
import { Bookmark, Copy, Ellipsis, Flag, Pencil, Share2, Trash2, X } from 'lucide-react'
import '../styles/feed-actions.css'

export type FeedActionPost = {
  id: number
  author: string
  content: string
  visibility?: 'public' | 'friends' | 'private'
  background?: string
  saved?: boolean
  repostKind?: 'quick' | 'quote'
  originalPost?: { id: number }
  attachments?: unknown[]
}
type Feedback = (message: string, kind?: 'success' | 'error') => void
type Props<P extends FeedActionPost> = {
  post: P
  mine: boolean
  request: (path: string, options?: RequestInit) => Promise<Response>
  onUpdated: (post: P) => void
  onDeleted: (id: number) => void
  onFeedback: Feedback
  onEdit?: (post: P) => void
}
const reasons = ['Nội dung spam', 'Quấy rối hoặc xúc phạm', 'Lừa đảo hoặc giả mạo', 'Thông tin gây hiểu lầm', 'Nội dung không phù hợp']

async function sharePost(id: number, feedback: Feedback, copyOnly = false) {
  try {
    const url = postShareUrl(id)
    if (!copyOnly && navigator.share) {
      await navigator.share({ title: 'Bài viết ChatNet', url })
    } else {
      await navigator.clipboard.writeText(url)
      feedback('Đã sao chép liên kết bài viết.', 'success')
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') feedback('Không thể chia sẻ bài viết.', 'error')
  }
}

export default function FeedPostActions<P extends FeedActionPost>({ post, mine, request, onUpdated, onDeleted, onFeedback, onEdit }: Props<P>) {
  const quickRepost = post.repostKind === 'quick'
  const shareTargetId = quickRepost ? post.originalPost?.id ?? post.id : post.id
  const deleteLabel = quickRepost ? 'Bỏ đăng lại' : 'Xóa bài viết'
  const portalContainer = useContext(ModalPortalContext)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [screenPosition, setScreenPosition] = useState({ top: 0, left: 0 })
  const [screen, setScreen] = useState<'options' | 'report' | 'delete'>('options')
  const [reason, setReason] = useState(reasons[0])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const element = panel.current
    if (!element) return
    const focusable = () => Array.from(
      element.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)'),
    ).filter(control => control.tabIndex >= 0)
    if (!element.contains(document.activeElement)) (focusable()[0] ?? element).focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!busy) {
          setOpen(false)
          trigger.current?.focus()
        }
        return
      }
      if (event.key !== 'Tab') return
      const controls = focusable()
      const first = controls[0]
      const last = controls[controls.length - 1]
      const active = document.activeElement
      if (!controls.some(control => control === active) || active === (event.shiftKey ? first : last)) {
        event.preventDefault()
        const target = (event.shiftKey ? last : first) ?? element
        target.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, screen, busy])

  function close() {
    setOpen(false)
    setScreen('options')
    trigger.current?.focus()
  }
  function openOptions() {
    if (open) { close(); return }
    const bounds = trigger.current?.getBoundingClientRect()
    setScreenPosition({
      top: Math.max(12, Math.min((bounds?.bottom ?? 60) + 6, window.innerHeight - 390)),
      left: Math.max(12, Math.min((bounds?.right ?? window.innerWidth) - 330, window.innerWidth - 342)),
    })
    setScreen('options')
    setOpen(true)
  }
  function startEdit() {
    close()
    onEdit?.(post)
  }
  async function send(path: string, options: RequestInit) {
    const response = await request(path, options)
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(data.error || 'Không thể thực hiện thao tác.')
    }
    return response
  }
  async function act(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await action() }
    catch (error) { onFeedback(error instanceof Error ? error.message : 'Thao tác thất bại.', 'error') }
    finally { setBusy(false) }
  }
  async function deletePost() {
    await act(async () => {
      await send('/api/posts/' + post.id, { method: 'DELETE' })
      close()
      onDeleted(post.id)
      onFeedback(quickRepost ? 'Đã bỏ đăng lại.' : 'Đã xóa bài viết.', 'success')
    })
  }
  async function savePost() {
    await act(async () => {
      const response = await send('/api/posts/' + post.id + '/save', { method: 'POST' })
      const updated = await response.json() as P
      onUpdated(updated)
      close()
      onFeedback(updated.saved ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.', 'success')
    })
  }
  async function reportPost() {
    await act(async () => {
      await send('/api/feed/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'post', targetId: post.id, reason }),
      })
      close()
      onFeedback('Đã gửi báo cáo.', 'success')
    })
  }

  return (
    <div className="feed-actions-root">
      <button ref={trigger} className="post-more" type="button" aria-label="Tùy chọn bài viết"
        aria-haspopup="dialog" aria-expanded={open} onClick={openOptions}>
        <Ellipsis size={21} />
      </button>
      {open && createPortal(
        <div className="feed-actions-overlay" data-feed-options={post.id}>
          <button type="button" className="feed-actions-backdrop" tabIndex={-1}
            aria-label="Đóng tùy chọn" onClick={close} />
          <section ref={panel} tabIndex={-1} className="feed-actions-panel" role="dialog" aria-modal="true" aria-label="Tùy chọn bài viết"
            style={{ top: screenPosition.top, left: screenPosition.left }}>
            <div className="feed-actions-grabber" aria-hidden="true" />
            <div className="feed-actions-header">
              <strong>{screen === 'report' ? 'Báo cáo bài viết' : screen === 'delete' ? quickRepost ? 'Xác nhận bỏ đăng lại' : 'Xác nhận xóa' : 'Tùy chọn bài viết'}</strong>
              <button type="button" onClick={close} aria-label="Đóng"><X size={19} /></button>
            </div>
            {screen === 'delete' ? (
              <div className="feed-actions-editor">
                <p className="feed-delete-warning">{quickRepost ? 'Bài viết gốc sẽ không bị xóa.' : 'Bài viết và các bình luận sẽ bị xóa vĩnh viễn. Bạn có chắc muốn xóa?'}</p>
                <div className="feed-actions-footer">
                  <button type="button" onClick={() => setScreen('options')}>Hủy</button>
                  <button type="button" className="feed-confirm-delete" disabled={busy}
                    onClick={() => void deletePost()}>{deleteLabel}</button>
                </div>
              </div>
            ) : screen === 'report' ? (
              <div className="feed-actions-editor">
                <label>Lý do báo cáo
                  <select value={reason} onChange={event => setReason(event.target.value)}>
                    {reasons.map(value => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <div className="feed-actions-footer">
                  <button type="button" onClick={() => setScreen('options')}>Hủy</button>
                  <button type="button" disabled={busy} onClick={() => void reportPost()}>Gửi báo cáo</button>
                </div>
              </div>
            ) : (
              <div className="feed-actions-list">
                <button type="button" disabled={busy} onClick={() => void savePost()}>
                  <Bookmark size={19} />{post.saved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
                </button>
                <button type="button" onClick={() => { close(); void sharePost(shareTargetId, onFeedback) }}>
                  <Share2 size={19} />Chia sẻ bài viết
                </button>
                <button type="button" onClick={() => { close(); void sharePost(shareTargetId, onFeedback, true) }}>
                  <Copy size={19} />Sao chép liên kết
                </button>
                {mine ? (
                  <>
                    <div className="feed-actions-separator" />
                    {onEdit && <button type="button" onClick={startEdit}><Pencil size={19} />Chỉnh sửa bài viết</button>}
                    <button type="button" className="danger" onClick={() => setScreen('delete')}>
                      <Trash2 size={19} />{deleteLabel}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="feed-actions-separator" />
                    <button type="button" onClick={() => setScreen('report')}><Flag size={19} />Báo cáo bài viết</button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>,
        portalContainer ?? document.body,
      )}
    </div>
  )
}
