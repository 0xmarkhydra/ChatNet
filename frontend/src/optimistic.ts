export function toggleCount<T extends { count: number; mine: boolean; emoji: string }>(
  reactions: T[], emoji: string,
): Array<T | { count: number; mine: boolean; emoji: string }> {
  const existing = reactions.find((item) => item.emoji === emoji)
  if (!existing) return [...reactions, { emoji, mine: true, count: 1 }]
  return reactions.map((item) => item.emoji === emoji
    ? { ...item, mine: !item.mine, count: Math.max(0, item.count + (item.mine ? -1 : 1)) }
    : item).filter((item) => item.count > 0)
}

export function mergeById<T extends { id: number }>(items: T[], incoming: T): T[] {
  return items.some((item) => item.id === incoming.id)
    ? items.map((item) => item.id === incoming.id ? incoming : item)
    : [...items, incoming]
}
