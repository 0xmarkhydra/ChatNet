import { useState, type FormEvent } from 'react'
import type { ApiRequest } from '@/shared/types/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { changeStoryHighlight } from '../api/stories'

type Props = { request: ApiRequest; storyId: number; initialTitle?: string; onSaved: () => void }

export default function StoryHighlightEditor({ request, storyId, initialTitle = '', onSaved }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !title.trim()) return
    setBusy(true)
    setError('')
    try {
      await changeStoryHighlight(request, storyId, title.trim())
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu Tin nổi bật.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-2">
      <label className="grid gap-1">Tên Tin nổi bật<Input value={title} onChange={event => setTitle(event.target.value)}
        required maxLength={40} disabled={busy} /></label>
      <p className="text-sm text-muted-foreground">Tin gốc được dùng làm ảnh bìa. Quyền xem của tin không thay đổi.</p>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !title.trim()}>Lưu Tin nổi bật</Button>
    </form>
  )
}
