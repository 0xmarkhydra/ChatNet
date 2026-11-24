import { useEffect, useState } from 'react'
import { joinGroupInvite, previewGroupInvite } from '../api/invites'
import { useLatest } from '../../../shared/hooks/useLatest'

export type GroupInvitePreview = {
  conversationId: number
  name: string
  memberCount: number
  requireApproval: boolean
  expiresAt: string
  isMember: boolean
  pending: boolean
}
export type GroupInviteDialogProps = {
  request: (path: string, init?: RequestInit) => Promise<Response>
  onJoined: (id: number) => Promise<void>
  notify: (text: string) => void
}


export function useGroupInviteJoinDialog({ request, onJoined, notify }: GroupInviteDialogProps) {
  const requestRef = useLatest(request)
  const [token, setToken] = useState(() => new URL(window.location.href).searchParams.get('groupInvite'))
  const [preview, setPreview] = useState<GroupInvitePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    // Remove the bearer-style invitation from browser history once captured.
    const current = new URL(window.location.href)
    current.searchParams.delete('groupInvite')
    window.history.replaceState(window.history.state, '', current.pathname + current.search + current.hash)
    let alive = true
    void previewGroupInvite(requestRef.current, token)
      .then(async response => {
        const value = await response.json() as GroupInvitePreview & { error?: string }
        if (!response.ok) throw new Error(value.error || 'Link mời hết hạn hoặc đã bị thu hồi.')
        if (alive) setPreview(value)
      })
      .catch(() => { if (alive) setError('Link mời không tồn tại, hết hạn hoặc đã bị thu hồi.') })
    return () => { alive = false }
  }, [requestRef, token])

  useEffect(() => {
    if (!token) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setToken(null) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [token])

  async function join() {
    if (!token || !preview || busy) return
    if (preview.isMember) {
      await onJoined(preview.conversationId)
      setToken(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await joinGroupInvite(request, token)
      const value = await response.json() as { error?: string; status?: string; conversationId?: number }
      if (!response.ok) throw new Error(value.error || 'Không thể tham gia nhóm.')
      if (value.status === 'pending') {
        notify('Đã gửi yêu cầu. Bạn sẽ tham gia khi quản trị viên phê duyệt.')
      } else {
        await onJoined(value.conversationId || preview.conversationId)
        notify('Đã tham gia nhóm thành công.')
      }
      setToken(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tham gia nhóm.')
    } finally {
      setBusy(false)
    }
  }


  return { token, preview, busy, error, close: () => setToken(null), join }
}
