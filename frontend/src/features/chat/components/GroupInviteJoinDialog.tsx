import { useEffect, useRef, useState } from 'react'
import { Link2, X, Users } from 'lucide-react'
import '../styles/group-governance.css'
import { joinGroupInvite, previewGroupInvite } from '../api/invites'

type Preview = {
  conversationId: number
  name: string
  memberCount: number
  requireApproval: boolean
  expiresAt: string
  isMember: boolean
  pending: boolean
}
type Props = {
  request: (path: string, init?: RequestInit) => Promise<Response>
  onJoined: (id: number) => Promise<void>
  notify: (text: string) => void
}

export default function GroupInviteJoinDialog({ request, onJoined, notify }: Props) {
  const requestRef = useRef(request)
  requestRef.current = request
  const [token, setToken] = useState(() => new URL(window.location.href).searchParams.get('groupInvite'))
  const [preview, setPreview] = useState<Preview | null>(null)
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
        const value = await response.json() as Preview & { error?: string }
        if (!response.ok) throw new Error(value.error || 'Link mời hết hạn hoặc đã bị thu hồi.')
        if (alive) setPreview(value)
      })
      .catch(() => { if (alive) setError('Link mời không tồn tại, hết hạn hoặc đã bị thu hồi.') })
    return () => { alive = false }
  }, [token])

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

  if (!token) return null
  return <div className="group-join-backdrop">
    <section className="group-join-dialog" role="dialog" aria-modal="true" aria-labelledby="group-join-title">
      <button type="button" className="group-join-close" onClick={() => setToken(null)} aria-label="Đóng"><X size={20} /></button>
      <div className="group-join-icon"><Link2 size={24} /></div>
      <h2 id="group-join-title">Lời mời tham gia nhóm</h2>
      {error && <p className="group-governance-error" role="alert">{error}</p>}
      {!preview && !error && <p>Đang kiểm tra link mời…</p>}
      {preview && <>
        <strong>{preview.name}</strong>
        <p><Users size={15} /> {preview.memberCount} thành viên</p>
        <small>Link có hiệu lực đến {new Date(preview.expiresAt).toLocaleString('vi-VN')}</small>
        <p>{preview.isMember ? 'Bạn đã là thành viên của nhóm này.' :
          preview.pending ? 'Yêu cầu tham gia của bạn đang chờ xét duyệt.' :
          preview.requireApproval ? 'Quản trị viên cần phê duyệt trước khi bạn tham gia.' :
          'Bạn có thể tham gia nhóm ngay bây giờ.'}</p>
      </>}
      <div className="group-join-actions">
        <button type="button" onClick={() => setToken(null)}>Đóng</button>
        {preview && !preview.pending && <button type="button" disabled={busy} onClick={() => void join()}>
          {preview.isMember ? 'Mở nhóm' : preview.requireApproval ? 'Gửi yêu cầu' : 'Tham gia nhóm'}
        </button>}
      </div>
    </section>
  </div>
}
