import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import QrScanner from 'qr-scanner'
import { X, Share2, Download } from 'lucide-react'
import './connection-tools.css'

export function profileFromQr(value: string, origin: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Mã QR không chứa link hồ sơ hợp lệ.') }
  if (url.origin !== origin || url.username || url.password || !['https:', 'http:'].includes(url.protocol)) throw new Error('Mã QR không phải hồ sơ ChatNet trên máy chủ này.')
  if (url.searchParams.getAll('connect').length !== 1) throw new Error('Mã QR không chứa hồ sơ hợp lệ.')
  const username = url.searchParams.get('connect')
  if (!username || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,30}[a-zA-Z0-9]$/.test(username)) throw new Error('Mã QR không chứa hồ sơ hợp lệ.')
  return username
}

export default function ProfileQr({ username, displayName, url, initialMode, onClose, onConnect }: {
  username: string
  displayName: string
  url: string
  initialMode: 'mine' | 'scan'
  onClose: () => void
  onConnect: (username: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const scanner = useRef<QrScanner | null>(null)
  const [mode, setMode] = useState<'mine' | 'scan'>(initialMode)
  const [image, setImage] = useState('')
  const [message, setMessage] = useState('')
  const [camera, setCamera] = useState(false)
  const [reading, setReading] = useState(false)
  const [match, setMatch] = useState('')
  const [sharing, setSharing] = useState(false)
  const alive = useRef(true)
  const fileRead = useRef(0)

  useEffect(() => {
    alive.current = true
    dialog.current?.showModal()
    return () => { alive.current = false; fileRead.current++; scanner.current?.destroy() }
  }, [])

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 720, margin: 4, errorCorrectionLevel: 'M' })
      .then((value) => { if (!cancelled) setImage(value) })
      .catch(() => { if (!cancelled) setMessage('Chưa tạo được mã QR. Đóng rồi thử lại.') })
    return () => { cancelled = true }
  }, [url])

  function read(value: string) {
    try {
      const found = profileFromQr(value, window.location.origin)
      if (found.toLowerCase() === username.toLowerCase()) throw new Error('Đây là mã QR của bạn.')
      setMatch(found)
      setMessage('')
      setCamera(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mã QR không hợp lệ.')
    }
  }

  useEffect(() => {
    if (!camera || mode !== 'scan' || !video.current) return
    let cancelled = false
    const instance = new QrScanner(video.current, (result) => {
      if (!cancelled) read(result.data)
    }, { preferredCamera: 'environment', maxScansPerSecond: 5, highlightScanRegion: true })
    scanner.current = instance
    instance.start().catch(() => {
      if (cancelled) return
      setCamera(false)
      setMessage('Không mở được camera. Kiểm tra quyền camera hoặc chọn ảnh QR.')
    })
    return () => {
      cancelled = true
      instance.destroy()
      scanner.current = null
    }
  }, [camera, mode, username])

  async function readFile(file?: File) {
    if (!file) return
    const request = ++fileRead.current
    setCamera(false)
    setMessage('')
    setMatch('')
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      setMessage('Chọn ảnh QR nhỏ hơn 15 MB.')
      return
    }
    setReading(true)
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      if (alive.current && request === fileRead.current) read(result.data)
    } catch {
      if (alive.current && request === fileRead.current) setMessage('Không tìm thấy QR trong ảnh. Chọn ảnh rõ, đủ bốn góc.')
    } finally {
      if (alive.current && request === fileRead.current) setReading(false)
    }
  }

  async function share() {
    if (sharing) return
    setSharing(true)
    setMessage('')
    try {
      const blob = await (await fetch(image)).blob()
      const file = new File([blob], `chatnet-${username}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: displayName })
      else if (navigator.share) await navigator.share({ title: displayName, url })
      else { await navigator.clipboard.writeText(url); setMessage('Đã sao chép link hồ sơ.') }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Chia sẻ chưa thành công. Bạn có thể tải ảnh QR.')
    } finally {
      if (alive.current) setSharing(false)
    }
  }

  return (
    <dialog ref={dialog} className="connection-dialog" aria-labelledby="qr-title" onCancel={onClose} onClose={onClose}>
      <header><h2 id="qr-title">Kết nối bằng QR</h2><button type="button" onClick={onClose} aria-label="Đóng QR" title="Đóng QR"><X size={20} /></button></header>
      <div className="connection-segments" aria-label="Chế độ QR">
        <button type="button" aria-pressed={mode === 'mine'} onClick={() => { fileRead.current++; setReading(false); setMode('mine'); setCamera(false); setMessage(''); setMatch('') }}>QR của tôi</button>
        <button type="button" aria-pressed={mode === 'scan'} onClick={() => { setMode('scan'); setMessage('') }}>Quét QR</button>
      </div>
      {mode === 'mine' ? (
        <div className="qr-identity">
          <strong>{displayName}</strong><span>@{username}</span>
          <div className="qr-image">{image ? <img src={image} alt={`Mã QR hồ sơ ${username}`} /> : <p role="status">Đang tạo mã QR...</p>}</div>
          <div className="connection-actions">
            <button type="button" disabled={!image || sharing} onClick={() => void share()}><Share2 size={18} />Chia sẻ QR</button>
            {image && <a href={image} download={`chatnet-${username}.png`}><Download size={18} />Tải ảnh QR</a>}
          </div>
        </div>
      ) : (
        <div className="qr-scan">
          <div className="qr-camera">
            {camera && <video ref={video} muted playsInline aria-label="Camera quét mã QR" />}
            {!camera && <strong>{match ? `@${match}` : 'Camera chưa bật'}</strong>}
          </div>
          {match ? <button type="button" className="connection-primary" onClick={() => onConnect(match)}>Xem hồ sơ @{match}</button> : (
            <button type="button" className="connection-primary" disabled={reading} onClick={() => { setMessage(''); setCamera(!camera) }}>
              {camera ? 'Tắt camera' : 'Bật camera'}
            </button>
          )}
          <label className="qr-upload">{reading ? 'Đang đọc ảnh...' : 'Chọn ảnh QR'}
            <input type="file" accept="image/*" disabled={reading} onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = '' }} />
          </label>
        </div>
      )}
      {message && <p className="connection-message" role="status">{message}</p>}
    </dialog>
  )
}
