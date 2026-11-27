import type { UiCopyKey } from '../i18n/locale'

export const reactionOptions = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
] as const

const reactionKeys: Record<string, UiCopyKey> = { '👍': 'common.ui.reactionLike', '❤️': 'common.ui.reactionLove', '😂': 'common.ui.reactionHaha', '😮': 'common.ui.reactionWow', '😢': 'common.ui.reactionSad', '😡': 'common.ui.reactionAngry' }
export function reactionLabel(emoji: string, t?: (key: UiCopyKey) => string): string {
  const key = reactionKeys[emoji]
  return t && key ? t(key) : reactionOptions.find((reaction) => reaction.emoji === emoji)?.label || emoji
}