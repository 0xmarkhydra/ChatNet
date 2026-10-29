import assert from 'node:assert/strict'
import {
  clearChatOutbox, confirmChatMessage, enqueueChatMessage,
  loadChatOutbox, retryableChatMessages, saveChatOutbox,
} from '../src/chatOutbox.ts'

const storage = new Map()
const store = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
const first = {
  clientId: 'offline-1', conversationId: 42, text: 'A gửi cho B lúc mất mạng',
  attachments: [], createdAt: '2026-10-29T03:00:00.000Z', status: 'queued',
}
const second = {
  ...first, clientId: 'offline-2', text: 'Tin kế tiếp',
  createdAt: '2026-10-29T03:00:01.000Z',
}
const failed = { ...first, clientId: 'invalid-3', status: 'failed', error: '403' }
let outbox = enqueueChatMessage([], first)
outbox = enqueueChatMessage(outbox, first)
assert.equal(outbox.length, 1, 'double submit cannot enqueue same clientId twice')
outbox = enqueueChatMessage(outbox, second)
outbox = enqueueChatMessage(outbox, failed)
assert.deepEqual(retryableChatMessages(outbox).map(x => x.clientId), ['offline-1', 'offline-2'])
assert.equal(saveChatOutbox(100, 'session-a', outbox, store), true)
assert.equal(loadChatOutbox(100, 'session-a', store).length, 3, 'offline outbox survives reload')
assert.deepEqual(loadChatOutbox(100, 'session-b', store), [], 'no cross-session delivery')
assert.deepEqual(loadChatOutbox(200, 'session-a', store), [], 'no cross-user delivery')

// The first HTTP acknowledgement is lost. The saved request and clientId
// remain unchanged when the UI retries after reconnect, including on reload.
let sendCalls = 0
const backendRecords = new Map()
function simulateSend(message) {
  sendCalls++
  if (!backendRecords.has(message.clientId)) backendRecords.set(message.clientId, { id: 501, text: message.text })
  return backendRecords.get(message.clientId)
}
const queued = loadChatOutbox(100, 'session-a', store)[0]
const sent = simulateSend(queued)
assert.equal(sent.id, 501)
const afterLostAck = loadChatOutbox(100, 'session-a', store)[0]
assert.equal(afterLostAck.clientId, queued.clientId)
const retried = simulateSend(afterLostAck)
assert.equal(retried.id, sent.id)
assert.equal(sendCalls, 2)
assert.equal(backendRecords.size, 1, 'lost ACK resend is idempotent')
outbox = confirmChatMessage(outbox, queued.clientId, queued.conversationId)
assert.equal(outbox.length, 2)
outbox = confirmChatMessage(outbox, queued.clientId, queued.conversationId)
assert.equal(outbox.length, 2, 'late realtime and HTTP receipts are both safe')
assert.equal(saveChatOutbox(100, 'session-a', outbox, store), true)
assert.equal(loadChatOutbox(100, 'session-a', store).length, 2)
assert.equal(JSON.stringify([...storage]).includes('Bearer'), false)

// Only safe upload metadata is kept, never temporary signed download URLs.
const withFile = {
  ...first, clientId: 'offline-file', text: '',
  attachments: [{ storageRef: 'chat/file/owned-ref', name: 'test.pdf',
    sizeBytes: 123, contentType: 'application/pdf', kind: 'file' }],
}
assert.equal(saveChatOutbox(100, 'session-a', [withFile], store), true)
assert.equal(loadChatOutbox(100, 'session-a', store)[0].attachments[0].storageRef, 'chat/file/owned-ref')
assert.equal(saveChatOutbox(100, 'session-a', [{ ...withFile, attachments: [
  { ...withFile.attachments[0], url: 'https://secret.example/?signed=token' },
] }], store), true)
assert.equal(JSON.stringify([...storage]).includes('secret.example'), false,
  'Never persist a signed URL even when a caller accidentally supplies one')
clearChatOutbox(100, store)
assert.deepEqual(loadChatOutbox(100, 'session-a', store), [])
console.log('PASS: offline outbox, double-submit, lost-ACK resend, recovery, isolation, realtime/HTTP dedupe')
