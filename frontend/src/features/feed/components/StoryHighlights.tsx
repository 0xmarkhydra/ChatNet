import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import type { ApiRequest } from '@/shared/types/api'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { changeStoryHighlight, readStoryHighlights, type StoryHighlight } from '../api/stories'
import StoryHighlightEditor from './StoryHighlightEditor'
import StoryViewer from './StoryViewer'
import '../styles/story-text.css'

type Props = { request: ApiRequest; username: string; owner?: boolean; className?: string; mobileProfile?: boolean }

function HighlightPreview({ item, full }: { item: StoryHighlight; full: boolean }) {
  const media = item.attachment
  const thumbnail = full ? 'size-full rounded-ui-md' : 'aspect-[9/16] w-full rounded-ui-md'
  if (!media) return (
    <span data-story-background={item.background} className={`${thumbnail} grid box-border place-items-center overflow-hidden p-2 text-center text-ui-label font-medium leading-snug text-white`}>
      <span className="line-clamp-3 wrap-anywhere">{item.text}</span>
    </span>
  )
  if (media.kind === 'video') return <video src={media.url} muted playsInline preload="metadata" aria-hidden="true"
    className={`${thumbnail} block bg-black ${full ? "object-cover" : "object-contain"}`} />
  return <img src={media.url} alt="" loading="lazy" className={`${thumbnail} block bg-black ${full ? "object-cover" : "object-contain"}`} />
}

export default function StoryHighlights({ request, username, owner = false, className, mobileProfile = false }: Props) {
  const [items, setItems] = useState<StoryHighlight[] | null>(null)
  const [revision, setRevision] = useState(0)
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null)
  const [managementId, setManagementId] = useState<number | null>(null)
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
      setManagementId(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gỡ Tin nổi bật.')
    } finally {
      setBusy(false)
    }
  }

  const full = mobileProfile
  const activeStory = items?.find(item => item.id === activeStoryId)
  if (!owner && (!items || items.length === 0)) return null
  return (
    <section className={cn('min-w-0 bg-card text-foreground', full ? 'py-ui-1' : 'rounded-ui-lg border border-solid border-border p-ui-4', className)} aria-label="Tin nổi bật">
      <h2 className={cn("m-0 mb-3", full ? "text-[length:var(--soco-type-section)]! font-semibold! tracking-[-0.3px] text-foreground!" : "text-ui-section font-semibold")}>Tin nổi bật</h2>
      {refreshError ? <div><p role="status">Không tải được Tin nổi bật.</p><Button size={full ? "lg" : "sm"} type="button" variant="outline" onClick={refresh}>Tải lại</Button></div>
        : !items ? <p role="status" className={full ? "min-h-46" : undefined}>Đang tải…</p>
        : items.length === 0 && <p className={cn("text-sm", full ? "text-foreground/80" : "text-muted-foreground")}>Mở Story của bạn và chọn “Thêm vào Tin nổi bật” để giữ tin trên hồ sơ.</p>}
      {items && items.length > 0 && (
        <ul role="list" className={cn("m-0 mt-2 grid list-none grid-flow-col gap-ui-2 overflow-x-auto overscroll-x-contain p-1", full ? "auto-cols-[calc(var(--spacing)*28)]" : "auto-cols-[calc((100%_-_1rem)/3)]")}>
          {items.map(item => (
            <li key={item.id} className="relative min-w-0">
              <button type="button" aria-label={item.title} onClick={() => setActiveStoryId(item.id)}
                className={cn("grid w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 font-sans focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring", full ? "relative h-46 w-28! overflow-hidden rounded-ui-md! text-left" : "gap-1.5 rounded-ui-md text-center text-foreground hover:bg-accent")}>
                <HighlightPreview item={item} full={full} />
                <span className={cn("wrap-anywhere text-ui-label leading-snug", full ? "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent px-ui-2 pt-ui-6 pb-ui-3 font-bold text-white" : "line-clamp-2 px-0.5 pb-0.5 font-medium")}><span className="line-clamp-2">{item.title}</span></span>
              </button>
              {owner && <Dialog open={managementId === item.id} onOpenChange={open => {
                if (!open && busy) return
                setManagementId(open ? item.id : null)
                setConfirmRemove(false)
                setEdit(false)
                setError('')
              }}>
                <DialogTrigger asChild>
                  <Button aria-label={'Quản lý Tin nổi bật: ' + item.title} variant="ghost"
                    className="group absolute right-1 top-1 size-control-touch items-start justify-end p-0 hover:bg-transparent">
                    <span className="pointer-events-none grid size-7 place-items-center rounded-lg bg-card/90 shadow-sm group-hover:bg-card">
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Quản lý Tin nổi bật</DialogTitle>
                  <DialogDescription>{item.title}</DialogDescription>
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
                </DialogContent>
              </Dialog>}
            </li>
          ))}
        </ul>
      )}
      {items && activeStory && createPortal(
        <StoryViewer mode="highlight" title={activeStory.title} activeStory={activeStory}
          stories={items} setActiveStoryId={setActiveStoryId} />,
        document.body,
      )}
    </section>
  )
}