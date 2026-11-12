import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, QrCode, ShieldCheck } from 'lucide-react'

type Props = { connectionUrl: string; onScanQr: () => void }

export default function ContactQrPanel({ connectionUrl, onScanQr }: Props) {
  const [qrImage, setQrImage] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(connectionUrl, { width: 400, margin: 2, errorCorrectionLevel: 'M' })
      .then(image => { if (!cancelled) setQrImage(image) })
      .catch(() => { if (!cancelled) setQrImage('') })
    return () => { cancelled = true }
  }, [connectionUrl])
  useEffect(() => { if (!copyStatus) return; const timer = window.setTimeout(() => setCopyStatus(''), 3500); return () => window.clearTimeout(timer) }, [copyStatus])
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(connectionUrl)
      setCopyStatus('Đã sao chép liên kết kết bạn')
    } catch { setCopyStatus('Không thể sao chép. Kiểm tra quyền clipboard.') }
  }

  return (
        <aside className="fd-card fd-qr-panel">
          <h2>Kết bạn bằng QR</h2><p>Chia sẻ mã QR cá nhân hoặc mở camera để quét.</p>
          <div className="fd-qr-preview">
            {qrImage && <img src={qrImage} alt="Mã QR liên kết kết bạn của tôi"/>}
          </div>
          <small>Mã QR chính xác của tài khoản hiện tại</small>
          <div className="fd-qr-actions">
            <button type="button" className="fd-secondary" onClick={() => void copyLink()}><Copy size={17}/>Sao chép link</button>
            <button type="button" className="fd-primary" onClick={onScanQr}><QrCode size={18}/>Quét QR</button>
          </div>
          {copyStatus && <p className="fd-copy-status" role="status">{copyStatus}</p>}
          <div className="fd-security-tip"><ShieldCheck size={20}/>
            <span><strong>An toàn khi kết nối</strong><small>Bạn quyết định ai có thể gửi yêu cầu.</small></span></div>
        </aside>
  )
}
