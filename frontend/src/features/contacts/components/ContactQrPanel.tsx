import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, QrCode, ShieldCheck } from 'lucide-react'

type Props = { connectionUrl: string; onScanQr: () => void }
type QrResult = { key: string; image?: string; error?: boolean }
type CopyResult = { url: string; message: string }

export default function ContactQrPanel({ connectionUrl, onScanQr }: Props) {
  const [qrResult, setQrResult] = useState<QrResult | null>(null)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)
  const [retry, setRetry] = useState(0)
  const qrKey = JSON.stringify([connectionUrl, retry])
  const qrImage = qrResult?.key === qrKey ? qrResult.image : undefined
  const qrError = !connectionUrl || (qrResult?.key === qrKey && Boolean(qrResult.error))
  const copyStatus = copyResult?.url === connectionUrl ? copyResult.message : ''

  useEffect(() => {
    if (!connectionUrl) return
    let cancelled = false
    QRCode.toDataURL(connectionUrl, { width: 400, margin: 2, errorCorrectionLevel: 'M' })
      .then(image => { if (!cancelled) setQrResult({ key: qrKey, image }) })
      .catch(() => { if (!cancelled) setQrResult({ key: qrKey, error: true }) })
    return () => { cancelled = true }
  }, [connectionUrl, qrKey])

  useEffect(() => {
    if (!copyStatus) return
    const timer = window.setTimeout(() => setCopyResult(null), 3500)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  async function copyLink() {
    if (!connectionUrl) return
    try {
      await navigator.clipboard.writeText(connectionUrl)
      setCopyResult({ url: connectionUrl, message: 'Đã sao chép liên kết kết bạn' })
    } catch {
      setCopyResult({ url: connectionUrl, message: 'Không thể sao chép. Kiểm tra quyền clipboard.' })
    }
  }

  return (
    <aside className="fd-card fd-qr-panel" aria-label="Mã QR kết bạn">
      <h2>Kết bạn bằng QR</h2>
      <p>Chia sẻ mã QR cá nhân hoặc mở camera để quét.</p>
      <div className="fd-qr-preview" aria-busy={!qrImage && !qrError}>
        {qrImage ? <img src={qrImage} alt="Mã QR liên kết kết bạn của tôi" /> :
          qrError ? <div className="fd-qr-fallback" role="alert">
            <span>{connectionUrl ? 'Không thể tạo mã QR.' : 'Chưa có liên kết kết bạn.'}</span>
            {connectionUrl && <button type="button" className="fd-secondary" onClick={() => setRetry(value => value + 1)}>Thử lại</button>}
          </div> : <span className="fd-qr-loading" role="status">Đang tạo mã QR...</span>}
      </div>
      <small>Mã QR của tài khoản hiện tại</small>
      <div className="fd-qr-actions">
        <button type="button" className="fd-secondary" disabled={!connectionUrl} onClick={() => void copyLink()}><Copy size={17} aria-hidden="true" />Sao chép link</button>
        <button type="button" className="fd-primary" onClick={onScanQr}><QrCode size={18} aria-hidden="true" />Quét QR</button>
      </div>
      {copyStatus && <p className="fd-copy-status" role="status">{copyStatus}</p>}
      <div className="fd-security-tip"><ShieldCheck size={20} aria-hidden="true" />
        <span><strong>An toàn khi kết nối</strong><small>Bạn quyết định ai có thể gửi yêu cầu.</small></span></div>
    </aside>
  )
}
