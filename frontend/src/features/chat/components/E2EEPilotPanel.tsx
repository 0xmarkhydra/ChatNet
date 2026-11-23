import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Fingerprint, KeyRound, LoaderCircle, LockKeyhole, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import {
  MLSPilotService, identitySafetyCode, type PilotStatus,
} from '../lib/mlsPilotService'
import type { ConversationEncryptionMode } from '../types'
import type { ApiRequest } from '../../../shared/types/api'
import type { MLSLocalMessage } from '../lib/mlsStateVault'
import './e2ee-pilot.css'

type Props = {
  conversationId: number
  userId: number
  otherUserId: number
  request: ApiRequest
  onModeChange: (mode: ConversationEncryptionMode) => void
}

export default function E2EEPilotPanel({
  conversationId, userId, otherUserId, request, onModeChange,
}: Props) {
  const service = useMemo(() =>
    new MLSPilotService(request, userId, otherUserId, conversationId),
  [conversationId, otherUserId, request, userId])
  const [status, setStatus] = useState<PilotStatus | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [pairCode, setPairCode] = useState('')
  const [peerReady, setPeerReady] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [trustStatus, setTrustStatus] = useState<'none' | 'unverified' | 'verified' | 'changed' | 'rekey'>('none')
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
    const state = await service.status()
    if (!aliveRef.current) return
    setStatus(state)
    onModeChange(state.autoEnabled ? 'pending' : state.mode)
    if (!state.pilotEnabled) return
    if (state.autoEnabled) {
      setReady(false)
      setPinned(false)
      setTrustStatus('none')
      setOwnApproved(false)
      setPeerApproved(false)
      setDeviceId(null)
      setPairCode('')
      setPeerReady(false)
      if (state.mode === 'e2ee') {
        try {
          const own = await service.ownDevice()
          if (!own) throw new Error('Khóa mã hóa trên trình duyệt này đã mất. Hiện chưa hỗ trợ khôi phục, nên không đọc lịch sử mã hóa hay gửi tin mới từ thiết bị này.')
          setDeviceId(own.deviceId)
          setMessages(await service.localMessages())
        } catch (e) {
          setMessages([])
          setError(e instanceof Error ? e.message : 'Không thể đọc lịch sử E2EE cục bộ')
        }
        if (!aliveRef.current) return
      }
      return
    }
    const own = await service.ownDevice()
    if (!aliveRef.current) return
    setDeviceId(own?.deviceId ?? null)
    const peer = await service.peerDevice()
    if (!aliveRef.current) return
    setPeerReady(!!peer)
    setPairCode(own && peer
      ? await identitySafetyCode(own.identity.publicKey, peer.identityKey) : '')
    const stored = own && peer ? await service.pinnedPeer() : null
    const verified = !!stored?.verified && !stored.identityChanged
    const trusted = verified && !stored?.rekeyRequired
    setPinned(verified)
    setTrustStatus(!peer ? 'none' : stored?.identityChanged ? 'changed'
      : stored?.rekeyRequired ? 'rekey' : verified ? 'verified' : 'unverified')
    if (state.mode === 'legacy' && own && trusted) {
      const approvals = await service.pilotApprovals()
      if (!aliveRef.current) return
      setOwnApproved(approvals.ownApproved)
      setPeerApproved(approvals.peerApproved)
    }
    if (own && trusted) {
      if (state.mode === 'e2ee') {
        const current = await service.sync()
        if (!aliveRef.current) return
        setMessages(current)
        setReady(await service.isReady())
      } else {
        setReady(await service.isReady())
      }
    } else {
      setReady(false)
      if (state.mode === 'e2ee' && own) setMessages(await service.localMessages())
      else if (!own) {
        setMessages([])
        if (state.mode === 'e2ee') {
          setError('Khóa mã hóa trên trình duyệt này đã mất. Hiện chưa hỗ trợ khôi phục, nên không đọc lịch sử mã hóa hay gửi tin mới từ thiết bị này.')
        }
      }
    }
  }, [service, onModeChange])

  useEffect(() => {
    aliveRef.current = true
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
    }
  }, [refresh])

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
        <strong>E2EE · Thử nghiệm 1–1</strong>
        <span className="mls-pilot-status">{status.mode === 'e2ee' ? 'Đã có MLS epoch ' + status.epoch : 'Chưa chuyển đổi'}</span>
        <button type="button" onClick={() => void perform(refresh)}
          disabled={busy} aria-label="Đồng bộ E2EE" title="Đồng bộ E2EE">
          {busy ? <LoaderCircle size={16} className="mls-pilot-spin" /> : <RefreshCw size={16}/>}
        </button>
      </header>
      {status.legacyHistory && (
        <p className="mls-pilot-warning" role="note">
          <ShieldAlert size={16} aria-hidden="true"/>
          Tin nhắn trước khi chuyển đổi vẫn là lịch sử không mã hóa đầu cuối.
          Chỉ các tin nhắn gửi bằng MLS sau khi thiết lập thành công mới được E2EE.
        </p>
      )}
      {status.autoEnabled ? (
        <p className="mls-pilot-warning" role="status" aria-live="polite">
          <ShieldAlert size={16} aria-hidden="true" /> Chế độ tự động chưa được hỗ trợ. Composer đang chờ; không gửi tin plaintext.
        </p>
      ) : (
        <p className="mls-pilot-note">
          Bản thử nghiệm trên một thiết bị mỗi tài khoản, chưa kiểm toán độc lập. Đối chiếu mã an toàn ngoài ứng dụng trước khi tin tưởng thiết bị. Lịch sử chat cũ vẫn chưa phải E2EE.
        </p>
      )}

      {!deviceId && !status.autoEnabled && (
        <button className="mls-pilot-primary" type="button" disabled={busy}
          onClick={() => void perform(() => service.prepareDevice())}>
          <KeyRound size={16} /> Chuẩn bị khóa thiết bị
        </button>
      )}
      {deviceId && !status.autoEnabled && (
        <div className="mls-pilot-trust">
          <div>
            <span>Mã an toàn · đối chiếu ở cả hai thiết bị <Fingerprint size={14} aria-hidden="true"/></span>
            {peerReady ? <code>{pairCode}</code> : <small>Người nhận chưa chuẩn bị E2EE</small>}
          </div>
        </div>
      )}
      {deviceId && peerReady && !pinned && !status.autoEnabled && (
        <button type="button" className="mls-pilot-primary" disabled={busy}
          onClick={() => void perform(() => service.confirmPeerIdentity(pairCode))}>
          <Fingerprint size={16}/> Tôi đã đối chiếu mã an toàn với người nhận
        </button>
      )}
      {pinned && (
        <div className="mls-pilot-verified" role="status" aria-live="polite">
          <CheckCircle2 size={15} aria-hidden="true" />
          Đã xác minh mã an toàn của thiết bị này.
        </div>
      )}
      {trustStatus === 'unverified' && (
        <p className="mls-pilot-warning" role="status" aria-live="polite">
          Chưa xác minh mã an toàn. Tin nhắn mới bị chặn cho đến khi bạn đối chiếu mã.
        </p>
      )}
      {trustStatus === 'changed' && (
        <p className="mls-pilot-warning" role="status" aria-live="polite">
          Khóa thiết bị đã đổi. Hãy đối chiếu mã an toàn mới để xác minh lại.
        </p>
      )}
      {trustStatus === 'rekey' && (
        <p className="mls-pilot-warning" role="status" aria-live="polite">
          Mã an toàn đã xác minh. Khóa đã đổi; pilot chưa hỗ trợ rekey nên đồng bộ và gửi tin vẫn bị chặn.
        </p>
      )}
      {deviceId && pinned && trustStatus === 'verified' && status.mode === 'legacy' && !status.autoEnabled && !ownApproved && (
        <button type="button" className="mls-pilot-primary" disabled={busy}
          onClick={() => void perform(() => service.approvePilot())}>
          <CheckCircle2 size={16}/> Tôi đồng ý dùng E2EE cho cuộc trò chuyện này
        </button>
      )}
      {deviceId && pinned && trustStatus === 'verified' && status.mode === 'legacy' && !status.autoEnabled && ownApproved && !peerApproved && (
        <p className="mls-pilot-note" role="status">Bạn đã đồng ý. Đang chờ người nhận xác nhận E2EE.</p>
      )}
      {deviceId && pinned && trustStatus === 'verified' && status.mode === 'legacy' && !status.autoEnabled && ownApproved && peerApproved && (
        <button type="button" className="mls-pilot-primary" disabled={busy}
          onClick={() => {
            if (window.confirm('Bắt đầu E2EE thử nghiệm? Tin mới sẽ đi qua MLS, không có fallback plaintext. Người nhận cần chuẩn bị khóa và xác minh mã an toàn trước.'))
              void perform(() => service.startConversation())
          }}>
          <LockKeyhole size={16}/> Bắt đầu hội thoại E2EE
        </button>
      )}
      {status.mode === 'e2ee' && !ready && !status.autoEnabled && trustStatus === 'verified' && deviceId && (
        <p className="mls-pilot-warning" role="status">
          <ShieldAlert size={16}/> Chưa có phiên MLS cục bộ. Đang chờ dữ liệu khởi tạo; pilot chưa hỗ trợ khôi phục khóa đã mất.
        </p>
      )}
      {status.mode === 'e2ee' && (ready || messages.length > 0) && (
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
          {ready && <form className="mls-pilot-composer" onSubmit={event => void submit(event)}>
            <label className="mls-pilot-sr" htmlFor={`mls-pilot-message-${conversationId}`}>Tin nhắn E2EE</label>
            <input id={`mls-pilot-message-${conversationId}`}
              value={draft} onChange={event => setDraft(event.target.value)}
              placeholder="Nhắn tin đã mã hóa MLS…" maxLength={4000} disabled={busy} />
            <button type="submit" className="mls-pilot-primary" disabled={busy || !draft.trim()}
              aria-label="Gửi tin nhắn E2EE"><Send size={17}/></button>
          </form>}
        </>
      )}
      {error && <p className="mls-pilot-error" role="alert">{error}</p>}
    </section>
  )
}
