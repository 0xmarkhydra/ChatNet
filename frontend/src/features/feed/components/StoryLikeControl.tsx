import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import type { ApiRequest } from '@/shared/types/api'
import { changeStoryLike, readStoryLikes } from '../api/stories'

const heartButton = 'grid size-12 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50'

/** Viewer's like toggle on someone else's story. */
export default function StoryLikeControl({ request, storyId }: { request: ApiRequest; storyId: number }) {
  const [liked, setLiked] = useState<boolean | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void readStoryLikes(request, storyId, controller.signal).then(data => {
      if (!controller.signal.aborted && 'liked' in data) setLiked(data.liked)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Không thể tải lượt thả tim.')
    })
    return () => controller.abort()
  }, [request, storyId, revision])

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
      <button type="button" className={heartButton} aria-label="Thả tim Story" aria-pressed={liked ?? false}
        title={liked ? 'Bỏ tim' : 'Thả tim'} disabled={liked === null || busy} onClick={() => void toggle()}>
        <Heart size={26} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {error && (
        <div className="absolute right-0 bottom-full z-5 mb-ui-2 min-w-44 rounded-ui-md bg-[#18233a] p-ui-2 text-white shadow-ui-overlay">
          <p role="status" className="m-0 px-ui-2 py-ui-1 text-ui-label text-white/85">{error}</p>
          {liked === null && <button type="button" className="min-h-control-touch w-full cursor-pointer rounded-ui-sm border-0 bg-white/10 px-ui-3 text-ui-label font-semibold text-white" onClick={() => {
            setError('')
            setRevision(value => value + 1)
          }}>Tải lại</button>}
        </div>
      )}
    </div>
  )
}
