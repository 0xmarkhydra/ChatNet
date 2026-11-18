import { useEffect, useId, useRef, useState } from 'react'
import { Repeat2 } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import type { ApiRequest } from '../../../shared/types/api'
import { publishRepost, undoRepost } from '../api/posts'
import type { Post } from '../types'

type Props = {
  post: Post
  request: ApiRequest
  onUpdated: (post: Post) => void
  onRemoved: (id: number) => void
  onChanged?: () => void
  onFeedback: (message: string, kind?: 'success' | 'error') => void
}

export default function FeedRepostAction({ post, request, onUpdated, onRemoved, onChanged, onFeedback }: Props) {
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

  if (post.originalPost || post.visibility === 'private') return null
  const removedId = post.myRepostId
  const label = removedId ? 'Đã đăng lại' : 'Đăng lại'
  const count = [...draft.trim()].length

  async function submit(kind: 'quick' | 'quote' | 'undo') {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (kind === 'undo') {
        const response = await undoRepost(request, post.id)
        if (!response.ok) throw new Error('Không thể bỏ đăng lại. Vui lòng thử lại.')
        if (!dialog.current?.isConnected) return
        if (removedId) onRemoved(removedId)
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
    <button type="button" className="post-stat feed-repost-action" data-reposted={Boolean(removedId)} aria-haspopup="dialog"
      aria-expanded={open} aria-label={label} onClick={() => { setError(''); setQuote(false); setOpen(true) }}>
      <Repeat2 size={21} aria-hidden="true" /><span>{label}</span>
    </button>
    {open && <dialog ref={dialog} aria-labelledby={title} aria-busy={busy}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/50"
      onCancel={(event) => { event.preventDefault(); if (!busy) setOpen(false) }}>
      <div className="grid gap-3">
        <h2 id={title} className="text-lg font-semibold">{quote ? 'Trích dẫn bài viết' : 'Đăng lại bài viết'}</h2>
        {quote ? <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (count > 0 && count <= 5000) void submit('quote') }}>
          <label className="grid gap-2">Ý kiến của bạn
            <textarea className="min-h-24 w-full resize-y rounded-lg border border-border bg-background p-3 text-foreground"
              value={draft} maxLength={10000} onChange={(event) => setDraft(event.target.value)} disabled={busy} />
          </label>
          <span className="text-sm text-muted-foreground">{count.toLocaleString('vi-VN')} / 5.000</span>
          <Button type="submit" disabled={busy || count === 0 || count > 5000}>Đăng bài trích dẫn</Button>
        </form> : <>
          <Button type="button" disabled={busy} onClick={() => void submit(removedId ? 'undo' : 'quick')}>
            {removedId ? 'Bỏ đăng lại' : 'Đăng lại ngay'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setQuote(true)}>Trích dẫn bài viết</Button>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Hủy</Button>
      </div>
    </dialog>}
  </>
}
