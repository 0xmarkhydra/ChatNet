import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, QrCode, ShieldCheck } from 'lucide-react'

type Props = { connectionUrl: string; onScanQr: () => void }
type QrResult = { key: string; image?: string; error?: boolean }
type CopyResult = { url: string; message: 'contacts.qrCopied' | 'contacts.copyFailed'; failed: boolean }

export default function ContactQrPanel({ connectionUrl, onScanQr }: Props) {
  const trUi = useUiTranslation()

  const [qrResult, setQrResult] = useState<QrResult | null>(null)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)
  const [copyPendingUrl, setCopyPendingUrl] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const qrKey = JSON.stringify([connectionUrl, retry])
  const qrImage = qrResult?.key === qrKey ? qrResult.image : undefined
  const qrError = !connectionUrl || (qrResult?.key === qrKey && Boolean(qrResult.error))
  const copyStatus = copyResult?.url === connectionUrl ? copyResult.message : ''
  const copying = Boolean(connectionUrl) && copyPendingUrl === connectionUrl

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
    if (!connectionUrl || copying) return
    const url = connectionUrl
    setCopyResult(null)
    setCopyPendingUrl(url)
    try {
      await navigator.clipboard.writeText(url)
      setCopyResult({ url, message: 'contacts.qrCopied', failed: false })
    } catch {
      setCopyResult({ url, message: 'contacts.copyFailed', failed: true })
    } finally {
      setCopyPendingUrl(current => current === url ? null : current)
    }
  }

  return (
    <aside className="fd-card fd-qr-panel" aria-label={trUi("common.ui.friendQR")}>
      <h2>{trUi('contacts.qrFriends')}</h2>
      <p>{trUi('contacts.qrShareHint')}</p>
      <div className="fd-qr-preview" aria-busy={!qrImage && !qrError}>
        {qrImage ? <img src={qrImage} alt={trUi("common.ui.myFriendQR")} /> :
          qrError ? <div className="fd-qr-fallback" role="alert">
            <span>{connectionUrl ? trUi('contacts.qrFailed') : trUi('contacts.qrMissing')}</span>
            {connectionUrl && <button type="button" className="fd-secondary" onClick={() => setRetry(value => value + 1)}>{trUi("common.retry")}</button>}
          </div> : <span className="fd-qr-loading" role="status">{trUi('contacts.qrLoading')}</span>}
      </div>
      <small>{trUi('contacts.qrCurrent')}</small>
      <div className="fd-qr-actions">
        <button type="button" className="fd-secondary" disabled={!connectionUrl || copying} aria-busy={copying} onClick={() => void copyLink()}><Copy size={17} aria-hidden="true" />{copying ? trUi('contacts.copying') : trUi("profile.copyLink")}</button>
        <button type="button" className="fd-primary" onClick={onScanQr}><QrCode size={18} aria-hidden="true" />{trUi("profile.scanQr")}</button>
      </div>
      {copyStatus && <p className={'fd-copy-status' + (copyResult?.failed ? ' is-error' : '')} role="status">{trUi(copyStatus)}</p>}
      <div className="fd-security-tip"><ShieldCheck size={20} aria-hidden="true" />
        <span><strong>{trUi('contacts.safeConnect')}</strong><small>{trUi('contacts.safeHint')}</small></span></div>
    </aside>
  )
}