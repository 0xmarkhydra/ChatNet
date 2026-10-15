import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bookmark, Check, Copy, Ellipsis, Flag, Pencil, Share2, Trash2, X } from 'lucide-react'
import './feed-actions.css'

export type FeedActionPost = {
  id: number
  author: string
  content: string
  visibility?: 'public' | 'friends' | 'private'
  background?: string
  saved?: boolean
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
}
const privacy = [
  { value: 'public', label: '🌐 Công khai' },
  { value: 'friends', label: '👥 Bạn bè' },
  { value: 'private', label: '🔒 Chỉ mình tôi' },
] as const
const backgrounds = ['', 'violet', 'blue', 'sunset', 'mint', 'night']
const reasons = ['Nội dung spam', 'Quấy rối hoặc xúc phạm', 'Lừa đảo hoặc giả mạo', 'Thông tin gây hiểu lầm', 'Nội dung không phù hợp']

function postUrl(id: number) {
  const url = new URL(window.location.href)
  url.searchParams.set('tab', 'feed')
  url.searchParams.set('post', String(id))
  return url.toString()
}

async function sharePost(id: number, feedback: Feedback, copyOnly = false) {
  try {
    const url = postUrl(id)
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

/** Only engagement actions live in the public post footer. */
export function FeedShareAction({ postId, onFeedback }: { postId: number; onFeedback: Feedback }) {
  return (
    <button type="button" className="post-stat feed-share-action"
      aria-label="Chia sẻ bài viết" onClick={() => void sharePost(postId, onFeedback)}>
      <Share2 size={20} aria-hidden="true" /><span>Chia sẻ</span>
    </button>
  )
}

export default function FeedPostActions<P extends FeedActionPost>({ post, mine, request, onUpdated, onDeleted, onFeedback }: Props<P>) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [screenPosition, setScreenPosition] = useState({ top: 0, left: 0 })
  const [screen, setScreen] = useState<'options' | 'edit' | 'report' | 'delete'>('options')
  const [content, setContent] = useState(post.content)
  const [visibility, setVisibility] = useState(post.visibility || 'public')
  const [background, setBackground] = useState(post.background || '')
  const [reason, setReason] = useState(reasons[0])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy])

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
    setContent(post.content)
    setVisibility(post.visibility || 'public')
    setBackground(post.background || '')
    setScreen('edit')
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
  async function saveEdit() {
    if (!content.trim() && !post.attachments?.length) return
    await act(async () => {
      const response = await send('/api/posts/' + post.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), visibility, background }),
      })
      onUpdated(await response.json() as P)
      close()
      onFeedback('Đã cập nhật bài viết.', 'success')
    })
  }
  async function deletePost() {
    await act(async () => {
      await send('/api/posts/' + post.id, { method: 'DELETE' })
      close()
      onDeleted(post.id)
      onFeedback('Đã xóa bài viết.', 'success')
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
          <section className="feed-actions-panel" role="dialog" aria-modal="true" aria-label="Tùy chọn bài viết"
            style={{ top: screenPosition.top, left: screenPosition.left }}>
            <div className="feed-actions-grabber" aria-hidden="true" />
            <div className="feed-actions-header">
              <strong>{screen === 'edit' ? 'Chỉnh sửa bài viết' : screen === 'report' ? 'Báo cáo bài viết' : screen === 'delete' ? 'Xác nhận xóa' : 'Tùy chọn bài viết'}</strong>
              <button type="button" onClick={close} aria-label="Đóng"><X size={19} /></button>
            </div>
            {screen === 'edit' ? (
              <div className="feed-actions-editor">
                <label>Nội dung bài viết
                  <textarea rows={5} maxLength={5000} value={content} onChange={event => setContent(event.target.value)} />
                </label>
                <label>Ai có thể xem?
                  <select value={visibility} onChange={event => setVisibility(event.target.value as typeof visibility)}>
                    {privacy.map(value => <option value={value.value} key={value.value}>{value.label}</option>)}
                  </select>
                </label>
                <span>Nền bài viết</span>
                <div className="feed-background-palette">
                  {backgrounds.map(value => (
                    <button type="button" key={value || 'none'}
                      className={'feed-palette-dot bg-' + (value || 'none')}
                      aria-label={value || 'Không có nền'}
                      aria-pressed={background === value} onClick={() => setBackground(value)}>
                      {background === value && <Check size={15} />}
                    </button>
                  ))}
                </div>
                <div className="feed-actions-footer">
                  <button type="button" onClick={() => setScreen('options')}>Hủy</button>
                  <button type="button" disabled={busy || (!content.trim() && !post.attachments?.length)}
                    onClick={() => void saveEdit()}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
                </div>
              </div>
            ) : screen === 'delete' ? (
              <div className="feed-actions-editor">
                <p className="feed-delete-warning">Bài viết và các bình luận sẽ bị xóa vĩnh viễn. Bạn có chắc muốn xóa?</p>
                <div className="feed-actions-footer">
                  <button type="button" onClick={() => setScreen('options')}>Hủy</button>
                  <button type="button" className="feed-confirm-delete" disabled={busy}
                    onClick={() => void deletePost()}>{busy ? 'Đang xóa…' : 'Xóa bài viết'}</button>
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
                <button type="button" onClick={() => { close(); void sharePost(post.id, onFeedback) }}>
                  <Share2 size={19} />Chia sẻ bài viết
                </button>
                <button type="button" onClick={() => { close(); void sharePost(post.id, onFeedback, true) }}>
                  <Copy size={19} />Sao chép liên kết
                </button>
                {mine ? (
                  <>
                    <div className="feed-actions-separator" />
                    <button type="button" onClick={startEdit}><Pencil size={19} />Chỉnh sửa bài viết</button>
                    <button type="button" className="danger" onClick={() => setScreen('delete')}>
                      <Trash2 size={19} />Xóa bài viết
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
        document.body,
      )}
    </div>
  )
}
