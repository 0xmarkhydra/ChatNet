import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import type { ApiRequest } from '@/shared/types/api'
import { userLabel } from '@/shared/utils/userLabel'
import { changeStoryLike, readStoryLikes, type StoryLiker } from '../api/stories'

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
        <button type="button" className="story-screen-icon-button" aria-expanded={open} aria-label="Người đã thả tim" title="Người đã thả tim"
          onClick={() => {
            if (!open) {
              setAfter(undefined)
              setLikers(null)
              setNext(undefined)
              setError('')
              onInspect()
            }
            setOpen(!open)
          }}><Heart size={19} aria-hidden="true" /></button>
      ) : (
        <button type="button" className="story-screen-icon-button" aria-label="Thả tim Story" aria-pressed={liked ?? false}
          title={liked ? 'Bỏ tim' : 'Thả tim'} disabled={liked === null || busy} onClick={() => void toggle()}>
          <Heart size={19} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      )}
      {(owner ? open : Boolean(error)) && (
        <div className="story-screen-options-menu max-h-52 min-w-40 overflow-auto p-2">
          {error && <p role="status">{error}</p>}
          {owner && (likers ? (
            likers.length === 0 ? <p>Chưa có ai thả tim.</p> : (
              <ul aria-label="Người đã thả tim">
                {likers.map(liker => <li key={liker.id}>{userLabel(liker.displayName, liker.username)}</li>)}
              </ul>
            )
          ) : !error && <p role="status">Đang tải…</p>)}
          {owner && next && next !== after && <button type="button" onClick={() => setAfter(next)}>Xem thêm</button>}
          {error && (owner || liked === null) && <button type="button" onClick={() => {
            setError('')
            setRevision(value => value + 1)
          }}>Tải lại</button>}
        </div>
      )}
    </div>
  )
}
