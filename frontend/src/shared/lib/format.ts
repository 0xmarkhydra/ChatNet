import type { MediaAttachment } from './media'

export function formatTime(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

export function attachmentLabel(items?: MediaAttachment[]) {
  const first = items?.[0]
  if (!first) return ''
  if (first.kind === 'image') return '[Ảnh]'
  if (first.kind === 'video') return '[Video]'
  if (first.kind === 'audio') return '[Âm thanh]'
  return '[Tệp]'
}
