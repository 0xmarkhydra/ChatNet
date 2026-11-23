const MAX_SIZE = 12 * 1024 * 1024
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const extensions = /\.(jpe?g|png|webp|gif|heic|heif)$/i

export function photoFileError(file: File): string {
  if (file.size > MAX_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
    return `Ảnh ${file.name} có dung lượng ${sizeMb} MB, vượt quá giới hạn 12 MB. Vui lòng chọn ảnh nhỏ hơn.`
  }
  if (!file.size) return 'Ảnh trống, vui lòng chọn ảnh khác.'
  if (!supportedTypes.has(file.type.toLowerCase()) || !extensions.test(file.name)) {
    return 'Vui lòng chọn ảnh JPG, PNG, WebP, GIF hoặc HEIC.'
  }
  return ''
}
