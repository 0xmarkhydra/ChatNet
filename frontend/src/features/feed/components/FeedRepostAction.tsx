import { useEffect, useId, useRef, useState } from 'react'
import { Copy, MessageCircle, Quote, Repeat2, Share2 } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import type { ApiRequest } from '../../../shared/types/api'
import { publishRepost, undoRepost } from '../api/posts'
import { postShareUrl } from '../utils/postSharing'
import type { Post } from '../types'
import { postActionClassName } from './postCardStyles'

type Props = {
  post: Post
  request: ApiRequest
  onUpdated: (post: Post) => void
  onRemoved?: (id: number) => void
  onShareToChat?: (url: string) => void
  onChanged?: () => void
  onFeedback: (message: string, kind?: 'success' | 'error') => void
}

export default function FeedRepostAction({ post, request, onUpdated, onRemoved, onChanged, onFeedback, onShareToChat }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [quote, setQuote] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()

  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [open])

  const canRepost = !post.originalPost && post.visibility !== 'private'
  const removedId = post.myRepostId
  const link = () => postShareUrl(post.repostKind === 'quick' ? post.originalPost?.id ?? post.id : post.id)
  const count = [...draft.trim()].length

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link())
      if (!dialog.current?.isConnected) return
      setOpen(false)
      onFeedback('Đã sao chép liên kết bài viết.', 'success')
    } catch {
      setError('Không thể sao chép liên kết bài viết.')
    }
  }

  async function submit(kind: 'quick' | 'quote' | 'undo') {
    if (busy || !canRepost) return
    setBusy(true)
    setError('')
    try {
      if (kind === 'undo') {
        const response = await undoRepost(request, post.id)
        if (!response.ok) throw new Error('Không thể bỏ đăng lại. Vui lòng thử lại.')
        if (!dialog.current?.isConnected) return
        if (removedId) onRemoved?.(removedId)
        onUpdated({ ...post, myRepostId: undefined, repostCount: Math.max(0, (post.repostCount ?? 0) - 1) })
      } else {
        const response = await publishRepost(request, post.id, kind, kind === 'quote' ? draft.trim() : '')
        if (!response.ok) throw new Error(response.status === 404
          ? 'Bài viết gốc không còn khả dụng.'
          : 'Không thể đăng lại bài viết. Vui lòng thử lại.')
        const updated = await response.json() as Post
        if (!dialog.current?.isConnected) return
        onUpdated(updated)
      }
      onChanged?.()
      setOpen(false)
      setDraft('')
      onFeedback(kind === 'undo' ? 'Đã bỏ đăng lại.' : kind === 'quote' ? 'Đã đăng bài trích dẫn.' : 'Đã đăng lại bài viết.', 'success')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể thực hiện thao tác.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button type="button" className={`post-stat feed-share-action feed-repost-action ${postActionClassName} data-[reposted=true]:text-primary!`} data-reposted={Boolean(removedId)} aria-haspopup="dialog"
      aria-expanded={open} aria-label="Chia sẻ bài viết" onClick={() => { setError(''); setQuote(false); setOpen(true) }}>
      <Share2 size={20} aria-hidden="true" /><span>Chia sẻ</span>
    </button>
    {open && <dialog ref={dialog} aria-labelledby={title} aria-busy={busy}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/50"
      onCancel={(event) => { event.preventDefault(); if (!busy) setOpen(false) }}>
      <div className="grid gap-3">
        <h2 id={title} className="text-lg font-semibold">{quote ? 'Đăng lại kèm lời' : 'Chia sẻ bài viết'}</h2>
        {quote ? <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (count > 0 && count <= 5000) void submit('quote') }}>
          <label className="grid gap-2">Ý kiến của bạn
            <textarea className="min-h-24 w-full resize-y rounded-lg border border-border bg-background p-3 text-foreground"
              value={draft} maxLength={10000} onChange={(event) => setDraft(event.target.value)} disabled={busy} />
          </label>
          <span className="text-sm text-muted-foreground">{count.toLocaleString('vi-VN')} / 5.000</span>
          <Button type="submit" disabled={busy || count === 0 || count > 5000}>Đăng bài trích dẫn</Button>
        </form> : <>
          {canRepost && <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(removedId ? 'undo' : 'quick')}>
              <Repeat2 aria-hidden="true" />{removedId ? 'Bỏ đăng lại' : 'Đăng lại ngay'}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setQuote(true)}>
              <Quote aria-hidden="true" />Đăng lại kèm lời
            </Button>
          </>}
          {onShareToChat && post.visibility !== 'private' && <Button type="button" variant="outline" disabled={busy}
            onClick={() => { setOpen(false); onShareToChat(link()) }}>
            <MessageCircle aria-hidden="true" />Gửi qua chat
          </Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => void copyLink()}>
            <Copy aria-hidden="true" />Sao chép liên kết
          </Button>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Hủy</Button>
      </div>
    </dialog>}
  </>
}
