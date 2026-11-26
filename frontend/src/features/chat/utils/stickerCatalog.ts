import { chatEmojiGroups } from './chatEmojiCatalog'

export type Sticker = { id: string; label: string; emoji: string; group: string }

export const stickers: Sticker[] = chatEmojiGroups.flatMap(group =>
  group.emojis.map(item => ({ id: item.emoji, label: item.label, emoji: item.emoji, group: group.name })),
)

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd')

export function searchStickers(query: string) {
  const needle = normalize(query.trim())
  return stickers.filter(item => normalize(item.label + ' ' + item.group + ' ' + item.emoji).includes(needle))
}

export async function stickerFile(sticker: Sticker): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể tạo sticker')
  context.font = '180px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(sticker.emoji, 128, 128)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Không thể tạo sticker')), 'image/png'))
  return new File([blob], 'sticker.png', { type: 'image/png' })
}
