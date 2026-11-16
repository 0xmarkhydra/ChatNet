/**
 * Media/message clipboard support. A chat image must be copied as real PNG
 * pixels, not its temporary signed S3 URL.
 */
const LINK_RE = /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#][^\s<>"']*)?/gi
const TRAILING_LINK_PUNCTUATION = /[),.!?;:\]}]+$/

export function messageLinkHref(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`
}

export function copyableMessageLinks(text: string): string[] {
  return [...new Set(messageTextParts(text).filter((part) => part.kind === 'link').map((part) => part.text))]
}

export type MessageTextPart = { kind: 'text' | 'link'; text: string }

// Keep visible punctuation outside the anchor. A plain text copy continues to
// include the exact original message, including periods and line breaks.
export function messageTextParts(text: string): MessageTextPart[] {
  const result: MessageTextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(LINK_RE)) {
    const at = match.index ?? 0
    // Do not transform the domain portion of email addresses or paths.
    if (at > 0 && /[\w@./-]/.test(text[at - 1])) continue
    if (at > cursor) result.push({ kind: 'text', text: text.slice(cursor, at) })
    const link = match[0].replace(TRAILING_LINK_PUNCTUATION, '')
    if (link) result.push({ kind: 'link', text: link })
    if (link.length < match[0].length) {
      result.push({ kind: 'text', text: match[0].slice(link.length) })
    }
    cursor = at + match[0].length
  }
  if (cursor < text.length) result.push({ kind: 'text', text: text.slice(cursor) })
  return result
}

function pngFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Không chuyển được ảnh sang PNG.'))
    }, 'image/png')
  })
}

async function imageToPng(source: string): Promise<Blob> {
  const url = new URL(source, window.location.href)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Địa chỉ ảnh không hợp lệ.')
  }
  // A browser can render a signed S3 image even when its CORS policy blocks
  // reading pixels for clipboard access. The dev server provides a restricted
  // same-origin fallback (not an arbitrary remote URL proxy).
  let response: Response
  try {
    response = await fetch(url.href, { mode: 'cors', credentials: 'omit' })
  } catch {
    const proxy = new URL('/__chatnet_copy_image', window.location.href)
    proxy.searchParams.set('url', url.href)
    response = await fetch(proxy.toString(), { cache: 'no-store', credentials: 'same-origin' })
  }
  if (!response.ok) {
    if (response.status === 403) throw new Error('Liên kết ảnh đã hết hạn hoặc kho lưu trữ từ chối truy cập. Hãy tải lại hội thoại.')
    throw new Error('Không tải được dữ liệu ảnh. Hãy kiểm tra kết nối hoặc cấu hình CORS của kho lưu trữ.')
  }
  const image = await response.blob()
  if (!image.type.toLowerCase().startsWith('image/')) {
    throw new Error('Tệp này không phải ảnh hợp lệ.')
  }
  if (image.type.toLowerCase() === 'image/png') return image

  const canvas = document.createElement('canvas')
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(image)
    try {
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      if (canvas.width === 0 || canvas.height === 0) throw new Error('Ảnh không hợp lệ.')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Không thể chuyển đổi ảnh trên thiết bị này.')
      context.drawImage(bitmap, 0, 0)
    } finally {
      bitmap.close()
    }
  } else {
    // Safari versions without createImageBitmap can decode a local Blob URL.
    const objectURL = URL.createObjectURL(image)
    try {
      const element = new Image()
      await new Promise<void>((resolve, reject) => {
        element.onload = () => resolve()
        element.onerror = () => reject(new Error('Không thể đọc định dạng ảnh này.'))
        element.src = objectURL
      })
      canvas.width = element.naturalWidth
      canvas.height = element.naturalHeight
      if (canvas.width === 0 || canvas.height === 0) throw new Error('Ảnh không hợp lệ.')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Không thể chuyển đổi ảnh trên thiết bị này.')
      context.drawImage(element, 0, 0)
    } finally {
      URL.revokeObjectURL(objectURL)
    }
  }
  return pngFromCanvas(canvas)
}

export async function copyChatImage(source: string): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Trình duyệt chưa hỗ trợ sao chép ảnh. Hãy dùng Chrome hoặc Safari mới.')
  }
  // Supply a Promise<Blob> directly to ClipboardItem in the click handler.
  // Safari requires the clipboard write to start before user activation expires.
  const image = imageToPng(source)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
}
