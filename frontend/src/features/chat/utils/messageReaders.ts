import type { Message } from '../types'

type ReaderMember = { id: number }

export type DirectDelivery = {
  messageId: number
  status: 'sent' | 'read'
}

export function getLatestDirectDelivery(
  messages: readonly Message[],
  currentUserId: number,
  peerId: number,
): DirectDelivery | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.senderId !== currentUserId || message.deleted || message.id <= 0) continue
    return {
      messageId: message.id,
      status: (message.readByUserIds || []).includes(peerId) ? 'read' : 'sent',
    }
  }
  return null
}

export function getLatestGroupReaderIdsByMessage(
  messages: readonly Message[],
  currentUserId: number,
  members: readonly ReaderMember[],
): Map<number, number[]> {
  const memberIds = new Set(members.map((member) => member.id))
  const seenReaders = new Set<number>()
  const markers = new Map<number, number[]>()

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.senderId !== currentUserId || message.deleted || message.id <= 0) continue

    const readerIds: number[] = []
    for (const readerId of message.readByUserIds || []) {
      if (readerId === currentUserId || !memberIds.has(readerId) || seenReaders.has(readerId)) continue
      seenReaders.add(readerId)
      readerIds.push(readerId)
    }
    if (readerIds.length > 0) markers.set(message.id, readerIds)
  }

  return markers
}
