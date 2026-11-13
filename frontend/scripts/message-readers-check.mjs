import assert from 'node:assert/strict'
import { getLatestDirectDelivery, getLatestGroupReaderIdsByMessage } from '../src/features/chat/utils/messageReaders.ts'

const message = (id, senderId, readByUserIds = [], extra = {}) => ({
  id, conversationId: 1, senderId, sender: `user-${senderId}`, text: `message-${id}`,
  createdAt: `2026-11-13T00:00:0${id}.000Z`, readByUserIds, ...extra,
})

assert.deepEqual(getLatestDirectDelivery([
  message(1, 1), message(2, 1, [2]), message(3, 2),
], 1, 2), { messageId: 2, status: 'read' })
assert.deepEqual(getLatestDirectDelivery([message(1, 1)], 1, 2), { messageId: 1, status: 'sent' })

assert.deepEqual([...getLatestGroupReaderIdsByMessage([
  message(1, 1, [2]), message(2, 1, [2, 3]),
], 1, [{ id: 1 }, { id: 2 }, { id: 3 }])], [[2, [2, 3]]])

assert.deepEqual([...getLatestGroupReaderIdsByMessage([
  message(1, 1, [2]), message(2, 1, [3]), message(3, 1, [2]),
], 1, [{ id: 1 }, { id: 2 }, { id: 3 }])], [[3, [2]], [2, [3]]])

assert.deepEqual([...getLatestGroupReaderIdsByMessage([
  message(1, 1, [1, 2, 4]), message(2, 1, [2], { deleted: true }), message(0, 1, [2]),
], 1, [{ id: 1 }, { id: 2 }])], [[1, [2]]])

assert.deepEqual([...getLatestGroupReaderIdsByMessage([
  message(10, 1, [2]),
], 1, [{ id: 1 }, { id: 2 }])], [[10, [2]]])

console.log('PASS: direct delivery status, latest group reader markers, departed readers, deleted and unsaved messages')
