import type { MediaAttachment } from '@/shared/utils/media'

const MAX_AVATAR_BYTES = 12 * 1024 * 1024
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const imageExtension = /\.(jpe?g|png|webp|gif|heic|heif)$/i

export type AvatarPhoto = MediaAttachment & { url: string }

export function isAvatarPhoto(item: MediaAttachment): item is AvatarPhoto {
  return item.kind === 'image' && typeof item.url === 'string'
    && /^https?:\/\//i.test(item.url)
    && item.sizeBytes > 0 && item.sizeBytes <= MAX_AVATAR_BYTES
    && imageTypes.has(item.contentType.toLowerCase()) && imageExtension.test(item.name)
}

export function avatarFileError(file: File) {
  if (!file.size) return 'Ảnh trống, vui lòng chọn ảnh khác.'
  if (file.size > MAX_AVATAR_BYTES) return 'Ảnh vượt quá 12 MB, vui lòng chọn ảnh nhỏ hơn.'
  if (!imageTypes.has(file.type.toLowerCase()) || !imageExtension.test(file.name)) {
    return 'Vui lòng chọn ảnh JPG, PNG, WebP, GIF hoặc HEIC.'
  }
  return ''
}

/** Feed and profile uploads have different server scopes. Copy the photo through the normal profile upload. */
export async function readAvatarPhoto(photo: AvatarPhoto, signal: AbortSignal) {
  const response = await fetch(photo.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error('Không tải được ảnh này. Hãy chọn ảnh khác hoặc tải ảnh từ thiết bị.')
  const blob = await response.blob()
  const file = new File([blob], photo.name, { type: blob.type })
  const error = avatarFileError(file)
  if (error) throw new Error(error)
  return file
}
