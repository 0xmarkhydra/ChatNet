export const reactionOptions = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
] as const

export function reactionLabel(emoji: string): string {
  return reactionOptions.find((reaction) => reaction.emoji === emoji)?.label || emoji
}
