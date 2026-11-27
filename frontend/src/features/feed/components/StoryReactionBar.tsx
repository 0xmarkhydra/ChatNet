import { useEffect, useState } from 'react'
import type { ApiRequest } from '@/shared/types/api'
import { reactionOptions } from '@/shared/utils/reactions'
import { cn } from '@/shared/lib/utils'
import { changeStoryReaction, readStoryReaction } from '../api/stories'

const loadError = 'Không thể tải cảm xúc.'

/** Viewer's single reaction on someone else's story: tap to set or switch, tap again to remove. */
export default function StoryReactionBar({ request, storyId }: { request: ApiRequest; storyId: number }) {
  // null = not known yet, '' = no reaction.
  const [mine, setMine] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void readStoryReaction(request, storyId, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setMine(data.liked ? data.emoji || '❤️' : '')
    }).catch(() => {
      if (!controller.signal.aborted) setError(loadError)
    })
    return () => controller.abort()
  }, [request, storyId, revision])

  async function choose(emoji: string) {
    if (busy || mine === null) return
    const desired = mine === emoji ? '' : emoji
    setBusy(true)
    setError('')
    try {
      await changeStoryReaction(request, storyId, desired)
      setMine(desired)
    } catch {
      setMine(null)
      setRevision(value => value + 1)
      setError('Không thể xác nhận thao tác. Đang kiểm tra lại trạng thái.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-ui-2 flex items-center gap-ui-2 rounded-ui-md bg-story-surface px-ui-3 py-ui-1 text-white">
          <p role="status" className="m-0 flex-1 text-ui-label text-white/85">{error}</p>
          {mine === null && <button type="button" className="min-h-control-touch cursor-pointer rounded-ui-sm border-0 bg-white/10 px-ui-3 text-ui-label font-semibold text-white" onClick={() => {
            setError('')
            setRevision(value => value + 1)
          }}>Tải lại</button>}
        </div>
      )}
      <div role="group" aria-label="Bày tỏ cảm xúc" className="flex justify-between">
        {reactionOptions.map(option => (
          <button key={option.emoji} type="button" aria-label={option.label} title={option.label} aria-pressed={mine === option.emoji}
            disabled={mine === null || busy} onClick={() => void choose(option.emoji)}
            className={cn('grid size-control-touch cursor-pointer place-items-center rounded-full border-0 p-0 text-2xl leading-none transition-transform disabled:cursor-not-allowed disabled:opacity-50',
              mine === option.emoji ? 'scale-110 bg-white/90' : 'bg-black/30 hover:bg-white/20')}>
            <span aria-hidden="true">{option.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
