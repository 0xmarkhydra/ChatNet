export type GroupChannel = {
  id: number
  conversationId: number
  name: string
  description: string
}

export function validGroupChannels(value: unknown, conversationId: number): GroupChannel[] {
  const general: GroupChannel = { id: 0, conversationId, name: 'Thảo luận chung', description: '' }
  if (!Array.isArray(value)) return [general]
  const byId = new Map<number, GroupChannel>([[0, general]])
  for (const item of value) {
    if (item && typeof item.id === 'number' && Number.isSafeInteger(item.id) &&
      item.id >= 0 && typeof item.name === 'string' && item.name.trim()) {
      byId.set(item.id, {
        id: item.id, conversationId,
        name: item.name, description: typeof item.description === 'string' ? item.description : '',
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.id - b.id)
}
