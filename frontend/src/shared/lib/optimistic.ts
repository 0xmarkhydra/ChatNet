export function toggleCount<T extends { count: number; mine: boolean; emoji: string }>(
  reactions: T[], emoji: string,
): Array<T | { count: number; mine: boolean; emoji: string }> {
  const existing = reactions.find((item) => item.emoji === emoji)
  if (!existing) return [...reactions, { emoji, mine: true, count: 1 }]
  return reactions.map((item) => item.emoji === emoji
    ? { ...item, mine: !item.mine, count: Math.max(0, item.count + (item.mine ? -1 : 1)) }
    : item).filter((item) => item.count > 0)
}

// A single user can have only one message reaction at a time, like Zalo.
export function toggleMessageReactionCount<T extends { count: number; mine: boolean; emoji: string }>(
  reactions: T[], emoji: string,
): Array<T | { count: number; mine: boolean; emoji: string }> {
  const mine = reactions.find((item) => item.mine)
  const cleared = reactions
    .map((item) => item.mine ? { ...item, mine: false, count: item.count - 1 } : item)
    .filter((item) => item.count > 0)
  if (mine?.emoji === emoji) return cleared
  const existing = cleared.find((item) => item.emoji === emoji)
  return existing
    ? cleared.map((item) => item.emoji === emoji ? { ...item, mine: true, count: item.count + 1 } : item)
    : [...cleared, { emoji, mine: true, count: 1 }]
}

export function mergeById<T extends { id: number }>(items: T[], incoming: T): T[] {
  return items.some((item) => item.id === incoming.id)
    ? items.map((item) => item.id === incoming.id ? incoming : item)
    : [...items, incoming]
}
