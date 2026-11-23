// Mirror the Story limits in backend/internal/mediax/media.go for early feedback.
const imageTypes: Record<string, string[]> = {
  jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'],
  webp: ['image/webp'], gif: ['image/gif'],
  heic: ['image/heic'], heif: ['image/heif'],
}
const videoTypes: Record<string, string[]> = {
  mp4: ['video/mp4'], mov: ['video/quicktime'],
  m4v: ['video/x-m4v', 'video/mp4'], webm: ['video/webm'],
}

export const STORY_MEDIA_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.m4v,.webm'

export function storyMediaError(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  const mime = file.type.toLowerCase().split(';')[0].trim()
  const types = imageTypes[ext] ?? videoTypes[ext]
  if (!types || (mime && mime !== 'application/octet-stream' && !types.includes(mime))) {
    return 'Chỉ hỗ trợ ảnh JPG, PNG, WebP, GIF, HEIC hoặc video MP4, MOV, M4V, WebM.'
  }
  const maxMB = ext in videoTypes ? 150 : 20
  if (file.size <= 0 || file.size > maxMB * 1024 * 1024) {
    return `Dung lượng ${ext in videoTypes ? 'video' : 'ảnh'} phải lớn hơn 0 và tối đa ${maxMB} MB.`
  }
  return null
}
