import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import type { ApiRequest } from '@/shared/types/api'
import { userLabel } from '@/shared/utils/userLabel'
import { changeStoryLike, readStoryLikes, type StoryLiker } from '../api/stories'

const heartButton = 'grid size-12 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-white hover:bg-white/15 aria-expanded:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50'
const menuText = 'm-0 px-ui-2 py-ui-1 text-ui-label text-white/85'

type Props = { request: ApiRequest; storyId: number; owner: boolean; onInspect: () => void }

export default function StoryLikeControl({ request, storyId, owner, onInspect }: Props) {
  const [open, setOpen] = useState(false)
  const [liked, setLiked] = useState<boolean | null>(null)
  const [likers, setLikers] = useState<StoryLiker[] | null>(null)
  const [next, setNext] = useState<number | undefined>()
  const [after, setAfter] = useState<number | undefined>()
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (owner && !open) return
    const controller = new AbortController()
    void readStoryLikes(request, storyId, controller.signal, after).then(data => {
      if (controller.signal.aborted) return
      if ('liked' in data) setLiked(data.liked)
      else {
        setLikers(current => after ? [...(current ?? []), ...data.likers] : data.likers)
        setNext(data.next)
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Không thể tải lượt thả tim.')
    })
    return () => controller.abort()
  }, [request, storyId, owner, open, after, revision])

  async function toggle() {
    if (busy || liked === null) return
    const desired = !liked
    setBusy(true)
    setError('')
    try {
      await changeStoryLike(request, storyId, desired)
      setLiked(desired)
    } catch {
      setLiked(null)
      setRevision(value => value + 1)
      setError('Không thể xác nhận thao tác. Đang kiểm tra lại trạng thái.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      {owner ? (
        <button type="button" className={heartButton} aria-expanded={open} aria-label="Người đã thả tim" title="Người đã thả tim"
          onClick={() => {
            if (!open) {
              setAfter(undefined)
              setLikers(null)
              setNext(undefined)
              setError('')
              onInspect()
            }
            setOpen(!open)
          }}><Heart size={26} aria-hidden="true" /></button>
      ) : (
        <button type="button" className={heartButton} aria-label="Thả tim Story" aria-pressed={liked ?? false}
          title={liked ? 'Bỏ tim' : 'Thả tim'} disabled={liked === null || busy} onClick={() => void toggle()}>
          <Heart size={26} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      )}
      {(owner ? open : Boolean(error)) && (
        <div className="absolute right-0 bottom-full z-5 mb-ui-2 max-h-52 min-w-44 overflow-auto rounded-ui-md bg-[#18233a] p-ui-2 text-white shadow-ui-overlay">
          {error && <p role="status" className={menuText}>{error}</p>}
          {owner && (likers ? (
            likers.length === 0 ? <p className={menuText}>Chưa có ai thả tim.</p> : (
              <ul aria-label="Người đã thả tim" className="m-0 grid list-none gap-ui-1 p-0">
                {likers.map(liker => <li key={liker.id} className={menuText}>{userLabel(liker.displayName, liker.username)}</li>)}
              </ul>
            )
          ) : !error && <p role="status" className={menuText}>Đang tải…</p>)}
          {owner && next && next !== after && <button type="button" className="min-h-control-touch w-full cursor-pointer rounded-ui-sm border-0 bg-white/10 px-ui-3 text-ui-label font-semibold text-white" onClick={() => setAfter(next)}>Xem thêm</button>}
          {error && (owner || liked === null) && <button type="button" className="min-h-control-touch w-full cursor-pointer rounded-ui-sm border-0 bg-white/10 px-ui-3 text-ui-label font-semibold text-white" onClick={() => {
            setError('')
            setRevision(value => value + 1)
          }}>Tải lại</button>}
        </div>
      )}
    </div>
  )
}
