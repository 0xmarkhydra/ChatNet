import { Link2, X, Users } from 'lucide-react'
import '../styles/group-governance.css'
import { useGroupInviteJoinDialog, type GroupInviteDialogProps } from '../hooks/useGroupInviteJoinDialog'

export default function GroupInviteJoinDialog({ request, onJoined, notify }: GroupInviteDialogProps) {
  const { token, preview, busy, error, close, join } = useGroupInviteJoinDialog({ request, onJoined, notify })
  if (!token) return null
  return <div className="group-join-backdrop">
    <section className="group-join-dialog" role="dialog" aria-modal="true" aria-labelledby="group-join-title">
      <button type="button" className="group-join-close" onClick={close} aria-label="Đóng"><X size={20} /></button>
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
        <button type="button" onClick={close}>Đóng</button>
        {preview && !preview.pending && <button type="button" disabled={busy} onClick={() => void join()}>
          {preview.isMember ? 'Mở nhóm' : preview.requireApproval ? 'Gửi yêu cầu' : 'Tham gia nhóm'}
        </button>}
      </div>
    </section>
  </div>
}