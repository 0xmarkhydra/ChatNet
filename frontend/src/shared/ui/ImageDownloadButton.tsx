import { useState } from 'react'
import { Download } from 'lucide-react'
import type { MediaAttachment } from '../utils/media'

export async function downloadOriginalImage(image: MediaAttachment): Promise<void> {
  if (image.kind !== 'image' || !image.url) throw new Error('Ảnh không còn khả dụng.')
  const source = new URL(image.url, window.location.href)
  if (!['https:', 'http:', 'blob:'].includes(source.protocol)) throw new Error('Địa chỉ ảnh không hợp lệ.')
  const response = await fetch(source.href, { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error(response.status === 403 ? 'Liên kết ảnh đã hết hạn hoặc không còn quyền truy cập.' : 'Không thể tải ảnh.')
  const blob = await response.blob()
  if (!blob.size || !blob.type.toLowerCase().startsWith('image/')) throw new Error('Dữ liệu ảnh không hợp lệ.')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = image.name || 'image'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export default function ImageDownloadButton({ image, menu = false, onComplete }: {
  image: MediaAttachment
  menu?: boolean
  onComplete?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await downloadOriginalImage(image)
      onComplete?.()
    } catch (cause) {
      setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : 'Không thể tải ảnh. Hãy kiểm tra kết nối và thử lại.')
    } finally {
      setBusy(false)
    }
  }
  return <>
    <button type="button" aria-label="Tải ảnh" disabled={busy} aria-busy={busy} onClick={() => void download()}>
      {menu ? <><span aria-hidden="true"><Download size={20} strokeWidth={2} /></span><b>Tải ảnh</b></>
        : <><Download size={18} aria-hidden="true" /><span>Tải ảnh</span></>}
    </button>
    {error && <small role="alert" className="image-download-error">{error}</small>}
  </>
}
