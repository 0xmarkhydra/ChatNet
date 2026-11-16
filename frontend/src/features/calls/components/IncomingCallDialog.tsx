import { Mic, Phone, PhoneOff, ShieldCheck, Video } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { CallView } from '../lib/calls'

type IncomingCallDialogProps = {
  incoming: CallView
  incomingName: string
  otherUsername?: string
  isGroup: boolean
  busy: boolean
  incomingPermission: string
  rejectIncoming: () => void
  acceptIncoming: () => void
  checkIncomingPermission: (kind: 'camera' | 'microphone') => void
}

export default function IncomingCallDialog({ incoming, incomingName, otherUsername, isGroup, busy, incomingPermission, rejectIncoming, acceptIncoming, checkIncomingPermission }: IncomingCallDialogProps) {
  return (
<div className="incoming-call-layer" role="dialog" aria-modal="true" aria-label="Cuộc gọi đến">
          <span className="incoming-call-brand">SocCo</span>
          <div className="incoming-call-layout">
            <div className="incoming-call-card">
              <strong className="incoming-call-title">Cuộc gọi đến</strong>
              <div className="incoming-call-orb">
                <UserAvatar
                  name={incomingName}
                  username={otherUsername}
                  group={isGroup}
                  className="incoming-call-avatar"
                />
                <span className="incoming-call-online-dot" />
              </div>
              <h2>{incomingName}</h2>
              <p className="incoming-call-subtitle">Đang gọi {incoming.mediaType === 'video' ? 'video' : 'thoại'} đến…</p>
              <div className="incoming-call-secure"><ShieldCheck size={16} /> Kết nối được bảo vệ bằng mã hóa đầu cuối E2EE</div>
              <div className="incoming-call-actions">
                <button type="button" className="call-reject" disabled={busy} onClick={() => void rejectIncoming()}>
                  <PhoneOff size={23} /><span>Từ chối</span>
                </button>
                <button type="button" className="call-accept" disabled={busy} onClick={() => void acceptIncoming()}>
                  {incoming.mediaType === 'video' ? <Video size={24} /> : <Phone size={23} />}<span>Trả lời</span>
                </button>
              </div>
            </div>
            <div className="incoming-call-information">
              <section className="incoming-call-info-box">
                <strong>ⓘ &nbsp; Quyền truy cập thiết bị</strong>
                <p>Khi trả lời, SocCo cần quyền truy cập camera và microphone trên thiết bị của bạn.</p>
                {incoming.mediaType === 'video' && <button type="button" disabled={busy} onClick={() => void checkIncomingPermission('camera')}><Video size={15} /> Camera · Kiểm tra quyền</button>}
                <button type="button" disabled={busy} onClick={() => void checkIncomingPermission('microphone')}><Mic size={15} /> Microphone · Kiểm tra quyền</button>
                {incomingPermission && <small role="status">{incomingPermission}</small>}
              </section>
              <section className="incoming-call-info-box">
                <strong>Bạn có quyền lựa chọn</strong>
                <p>Bạn có thể chỉ trả lời bằng thoại hoặc tắt camera ngay khi kết nối.</p>
              </section>
            </div>
          </div>
        </div>
  )
}
