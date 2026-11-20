import { useEffect, useState } from 'react'
import type { ApiRequest } from '@/shared/types/api'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { changeStoryHighlight, readStoryHighlights, type StoryHighlight } from '../api/stories'
import StoryHighlightEditor from './StoryHighlightEditor'
import '../styles/story-text.css'

type Props = { request: ApiRequest; username: string; owner?: boolean }

function HighlightMedia({ item, preview = false }: { item: StoryHighlight; preview?: boolean }) {
  const media = item.attachment
  const thumbnail = 'aspect-square w-full rounded-ui-sm'
  if (!media) {
    const background = item.background ?? 'berry'
    return preview ? (
      <span data-story-background={background} className={`${thumbnail} grid box-border place-items-center overflow-hidden p-2 text-center text-ui-label font-medium leading-snug text-white`}>
        <span className="line-clamp-3 wrap-anywhere">{item.text}</span>
      </span>
    ) : (
      <div data-story-background={background} className="rounded-lg p-6 text-center text-white"><p className="wrap-anywhere whitespace-pre-wrap">{item.text}</p></div>
    )
  }
  if (media.kind === 'video') return <video src={media.url} controls={!preview} muted={preview} playsInline preload={preview ? 'metadata' : 'auto'}
    aria-label={media.name} aria-hidden={preview || undefined} className={preview ? `${thumbnail} block object-cover` : 'max-h-[52dvh] w-full rounded-lg'} />
  return <img src={media.url} alt={preview ? '' : media.name} loading="lazy" className={preview ? `${thumbnail} block object-cover` : 'max-h-[52dvh] w-full rounded-lg object-contain'} />
}

export default function StoryHighlights({ request, username, owner = false }: Props) {
  const [items, setItems] = useState<StoryHighlight[] | null>(null)
  const [revision, setRevision] = useState(0)
  const [focus, setFocus] = useState<number | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void readStoryHighlights(request, username, controller.signal).then(result => {
      if (!controller.signal.aborted) setItems(result)
    }).catch(() => {
      if (!controller.signal.aborted) setRefreshError(true)
    })
    return () => controller.abort()
  }, [request, username, revision])

  function refresh() {
    setRefreshError(false)
    setRevision(value => value + 1)
  }

  async function remove(id: number) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await changeStoryHighlight(request, id)
      setItems(current => current?.filter(item => item.id !== id) ?? null)
      setFocus(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gỡ Tin nổi bật.')
    } finally {
      setBusy(false)
    }
  }

  if (!owner && (!items || items.length === 0)) return null
  return (
    <section className="rounded-ui-lg border border-border bg-card p-3 text-foreground" aria-label="Tin nổi bật">
      <h2 className="m-0 mb-3 text-ui-section font-semibold">Tin nổi bật</h2>
      {refreshError ? <div><p role="status">Không tải được Tin nổi bật.</p><Button size="sm" type="button" variant="outline" onClick={refresh}>Tải lại</Button></div>
        : !items ? <p role="status">Đang tải…</p>
        : items.length === 0 && <p className="text-sm text-muted-foreground">Mở Story của bạn và chọn “Thêm vào Tin nổi bật” để giữ tin trên hồ sơ.</p>}
      {items && items.length > 0 && (
        <ul role="list" className="m-0 flex list-none gap-2 overflow-x-auto p-1">
          {items.map(item => (
            <li key={item.id} className="w-28 shrink-0">
              <Dialog open={focus === item.id} onOpenChange={open => {
                if (!open && busy) return
                setFocus(open ? item.id : null)
                setConfirmRemove(false)
                setEdit(false)
                setError('')
              }}>
                <DialogTrigger asChild>
                  <button type="button" aria-label={item.title} className="grid w-full min-w-0 cursor-pointer appearance-none gap-1.5 rounded-ui-md border border-solid border-border bg-card p-1.5 text-left font-sans text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring">
                    <HighlightMedia item={item} preview />
                    <span className="line-clamp-2 wrap-anywhere px-0.5 pb-0.5 text-ui-label font-medium leading-snug">{item.title}</span>
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>{item.title}</DialogTitle>
                  <DialogDescription>Tin nổi bật trên hồ sơ của {item.authorDisplayName || item.author}.</DialogDescription>
                  <HighlightMedia item={item} />
                  {owner && <>
                    {error && <p role="alert">{error}</p>}
                    {edit ? <StoryHighlightEditor request={request} storyId={item.id} initialTitle={item.title} onSaved={() => {
                      setEdit(false)
                      refresh()
                    }} /> : <Button type="button" variant="outline" disabled={busy || confirmRemove} onClick={() => setEdit(true)}>Đổi tên</Button>}
                    {confirmRemove ? <div className="grid gap-2">
                      <p>Gỡ tin khỏi hồ sơ? Story chưa hết hạn vẫn xuất hiện trong danh sách Story thường.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" disabled={busy} onClick={() => void remove(item.id)}>Xác nhận gỡ</Button>
                        <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmRemove(false)}>Giữ lại</Button>
                      </div>
                    </div> : <Button type="button" variant="outline" disabled={busy || edit} onClick={() => setConfirmRemove(true)}>Gỡ khỏi Tin nổi bật</Button>}
                  </>}
                </DialogContent>
              </Dialog>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}