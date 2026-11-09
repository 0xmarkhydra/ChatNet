export const messageReactions = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
] as const

export function messageReactionLabel(emoji: string): string {
  return messageReactions.find((reaction) => reaction.emoji === emoji)?.label || emoji
}
