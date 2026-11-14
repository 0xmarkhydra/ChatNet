import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Fingerprint, KeyRound, LoaderCircle, LockKeyhole, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import {
  MLSPilotService, identitySafetyCode, type PilotStatus,
} from '../lib/mlsPilotService'
import type { ApiRequest } from '../../../shared/types/api'
import type { MLSLocalMessage } from '../lib/mlsStateVault'
import './e2ee-pilot.css'

type Props = {
  conversationId: number
  userId: number
  otherUserId: number
  request: ApiRequest
  onModeChange: (mode: 'unknown' | 'legacy' | 'pending' | 'e2ee') => void
}

export default function E2EEPilotPanel({
  conversationId, userId, otherUserId, request, onModeChange,
}: Props) {
  const service = useMemo(() =>
    new MLSPilotService(request, userId, otherUserId, conversationId),
  [conversationId, otherUserId, request, userId])
  const [status, setStatus] = useState<PilotStatus | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [myCode, setMyCode] = useState('')
  const [peerCode, setPeerCode] = useState('')
  const [peerReady, setPeerReady] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [ready, setReady] = useState(false)
  const [ownApproved, setOwnApproved] = useState(false)
  const [peerApproved, setPeerApproved] = useState(false)
  const [messages, setMessages] = useState<MLSLocalMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const aliveRef = useRef(true)

  const refresh = useCallback(async () => {
    let state = await service.status()
    if (!aliveRef.current) return
    setStatus(state)
    onModeChange(state.mode === 'legacy' && state.autoEnabled ? 'pending' : state.mode)
    if (!state.pilotEnabled) return
    if (state.autoEnabled) {
      // Auto-onboarding only runs for eligible EMPTY direct rooms. The lower
      // user ID initializes, while the other client waits for a Welcome.
      await service.advanceAuto()
      if (!aliveRef.current) return
      state = await service.status()
      setStatus(state)
      onModeChange(state.mode === 'legacy' && state.autoEnabled ? 'pending' : state.mode)
    }
    const own = await service.ownDevice()
    if (!aliveRef.current) return
    setDeviceId(own?.deviceId ?? null)
    setMyCode(own ? await identitySafetyCode(own.identity.publicKey) : '')
    const peer = await service.peerDevice()
    if (!aliveRef.current) return
    setPeerReady(!!peer)
    setPeerCode(peer ? await identitySafetyCode(peer.identityKey) : '')
    const stored = own && peer ? await service.pinnedPeer() : null
    setPinned(!!stored)
    if (state.mode === 'legacy' && own && stored) {
      const approvals = await service.pilotApprovals()
      if (!aliveRef.current) return
      setOwnApproved(approvals.ownApproved)
      setPeerApproved(approvals.peerApproved)
    }
    if (own && stored) {
      const hasState = await service.isReady()
      if (!aliveRef.current) return
      setReady(hasState)
      if (state.mode === 'e2ee') {
        const current = await service.sync()
        if (!aliveRef.current) return
        setMessages(current)
        setReady(await service.isReady())
      }
    } else {
      setReady(false)
    }
  }, [service, onModeChange])

  useEffect(() => {
    aliveRef.current = true
    onModeChange('unknown')
    let cancelled = false
    const startup = window.setTimeout(() => {
      if (busyRef.current) return
      busyRef.current = true
      void refresh().catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Không thể kiểm tra E2EE')
      }).finally(() => { busyRef.current = false })
    }, 0)
    const timer = window.setInterval(() => {
      if (busyRef.current || document.visibilityState !== 'visible') return
      busyRef.current = true
      void refresh().catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Đồng bộ E2EE thất bại')
      }).finally(() => { busyRef.current = false })
    }, 4000)
    return () => {
      cancelled = true
      aliveRef.current = false
      window.clearTimeout(startup)
      window.clearInterval(timer)
      onModeChange('unknown')
    }
  }, [refresh, onModeChange])

  async function perform(action: () => Promise<unknown>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác E2EE không thành công')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || busy || !ready) return
    await perform(async () => {
      await service.send(message)
      setDraft('')
    })
  }

  if (!status) return null
  if (!status.pilotEnabled && status.mode === 'legacy') return null
  if (!status.pilotEnabled) {
    return (
      <section className="mls-pilot-panel" aria-label="Trạng thái E2EE">
        <div className="mls-pilot-heading">
          <LockKeyhole size={17} aria-hidden="true" />
          <span>Hội thoại E2EE: máy chủ chưa bật tính năng thử nghiệm để tiếp tục đồng bộ.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="mls-pilot-panel" aria-label="Nhắn tin E2EE thử nghiệm">
      <header className="mls-pilot-heading">
        <LockKeyhole size={18} aria-hidden="true" />
        <strong>{status.autoEnabled ? 'E2EE tự động · 1–1 thử nghiệm' : 'E2EE · Thử nghiệm 1–1'}</strong>
        <span className="mls-pilot-status">{status.mode === 'e2ee' ? 'Đã có MLS epoch ' + status.epoch : 'Chưa chuyển đổi'}</span>
        <button type="button" onClick={() => void perform(refresh)}
          disabled={busy} aria-label="Đồng bộ E2EE" title="Đồng bộ E2EE">
          {busy ? <LoaderCircle size={16} className="mls-pilot-spin" /> : <RefreshCw size={16}/>}
        </button>
      </header>
      <p className="mls-pilot-note">
        {status.autoEnabled
          ? 'Đang tự tạo khóa và thiết lập MLS khi cả hai người mở chat. Khóa lần đầu được ghim TOFU; hãy tự đối chiếu mã an toàn qua kênh khác để xác thực danh tính. Không gửi plaintext nếu chưa sẵn sàng.'
          : 'Bản thử nghiệm trên một thiết bị mỗi tài khoản, chưa kiểm toán độc lập. Đối chiếu mã an toàn ngoài ứng dụng trước khi tin tưởng thiết bị. Lịch sử chat cũ vẫn chưa phải E2EE.'}
      </p>

      {!deviceId && !status.autoEnabled && (
        <button className="mls-pilot-primary" type="button" disabled={busy}
          onClick={() => void perform(() => service.prepareDevice())}>
          <KeyRound size={16} /> Chuẩn bị khóa thiết bị
        </button>
      )}
      {deviceId && (
        <div className="mls-pilot-trust">
          <div>
            <span>Thiết bị của bạn <Fingerprint size={14} aria-hidden="true"/></span>
            <code>{myCode}</code>
          </div>
          <div>
            <span>Thiết bị người nhận</span>
            {peerReady ? <code>{peerCode}</code> : <small>Người nhận chưa chuẩn bị E2EE</small>}
          </div>
        </div>
      )}
      {deviceId && peerReady && !pinned && !status.autoEnabled && (
        <button type="button" className="mls-pilot-primary" disabled={busy}
          onClick={() => void perform(() => service.confirmPeerIdentity())}>
          <Fingerprint size={16}/> Tôi đã đối chiếu mã an toàn với người nhận
        </button>
      )}
      {pinned && (
        <div className="mls-pilot-verified">
          <CheckCircle2 size={15} aria-hidden="true" />
          Đã ghim khóa thiết bị. Thay đổi khóa sẽ bị từ chối.
        </div>
      )}
      {deviceId && pinned && status.mode === 'legacy' && !status.autoEnabled && !ownApproved && (
        <button type="button" className="mls-pilot-primary" disabled={busy}
          onClick={() => void perform(() => service.approvePilot())}>
          <CheckCircle2 size={16}/> Tôi đồng ý dùng E2EE cho cuộc trò chuyện này
        </button>
      )}
      {deviceId && pinned && status.mode === 'legacy' && !status.autoEnabled && ownApproved && !peerApproved && (
        <p className="mls-pilot-note" role="status">Bạn đã đồng ý. Đang chờ người nhận xác nhận E2EE.</p>
      )}
      {deviceId && pinned && status.mode === 'legacy' && !status.autoEnabled && ownApproved && peerApproved && (
        <button type="button" className="mls-pilot-primary" disabled={busy}
          onClick={() => {
            if (window.confirm('Bắt đầu E2EE thử nghiệm? Tin mới sẽ đi qua MLS, không có fallback plaintext. Người nhận cần chuẩn bị khóa và xác minh mã an toàn trước.'))
              void perform(() => service.startConversation())
          }}>
          <LockKeyhole size={16}/> Bắt đầu hội thoại E2EE
        </button>
      )}
      {status.mode === 'legacy' && status.autoEnabled && (
        <p className="mls-pilot-warning" role="status">
          <ShieldAlert size={16}/> Đang chờ hai thiết bị chuẩn bị khóa và tạo phiên MLS.
          Tin nhắn mới chỉ được gửi khi mã hóa sẵn sàng.
        </p>
      )}
      {status.mode === 'e2ee' && !ready && (
        <p className="mls-pilot-warning">
          <ShieldAlert size={16}/> Đang chờ Welcome/khôi phục khóa từ thiết bị đã đăng ký.
          Không được gửi tin plaintext để thay thế.
        </p>
      )}
      {status.mode === 'e2ee' && ready && (
        <>
          <div className="mls-pilot-thread" role="log" aria-label="Tin nhắn đã mã hóa đầu cuối">
            {messages.length === 0 && <p className="mls-pilot-empty">Chưa có tin nhắn mã hóa. Hãy thử gửi lời chào 🔐</p>}
            {messages.map(message => (
              <div className={'mls-pilot-message' + (message.senderId === userId ? ' mine' : '')}
                key={message.id}>
                <span className="mls-pilot-message-meta">
                  {message.senderId === userId ? 'Bạn' : 'Người nhận'} ·
                  {new Date(message.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'})}
                </span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form className="mls-pilot-composer" onSubmit={event => void submit(event)}>
            <label className="mls-pilot-sr" htmlFor={`mls-pilot-message-${conversationId}`}>Tin nhắn E2EE</label>
            <input id={`mls-pilot-message-${conversationId}`}
              value={draft} onChange={event => setDraft(event.target.value)}
              placeholder="Nhắn tin đã mã hóa MLS…" maxLength={4000} disabled={busy} />
            <button type="submit" className="mls-pilot-primary" disabled={busy || !draft.trim()}
              aria-label="Gửi tin nhắn E2EE"><Send size={17}/></button>
          </form>
        </>
      )}
      {error && <p className="mls-pilot-error" role="alert">{error}</p>}
    </section>
  )
}
