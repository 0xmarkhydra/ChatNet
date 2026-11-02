import assert from 'node:assert/strict'
import {
  clearChatOutbox, confirmChatMessage, enqueueChatMessage,
  loadChatOutbox, persistChatOutboxChange, retryableChatMessages,
} from '../src/chatOutbox.ts'

const storage = new Map()
const store = {
  get length() { return storage.size },
  key: (index) => [...storage.keys()][index] ?? null,
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => { storage.set(key, value) },
  removeItem: (key) => { storage.delete(key) },
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
let previous = []
let outbox = enqueueChatMessage([], first)
outbox = enqueueChatMessage(outbox, first)
assert.equal(outbox.length, 1, 'double submit cannot enqueue same clientId twice')
outbox = enqueueChatMessage(outbox, second)
outbox = enqueueChatMessage(outbox, failed)
assert.deepEqual(retryableChatMessages(outbox).map(x => x.clientId), ['offline-1', 'offline-2'])
assert.equal(persistChatOutboxChange(100, 'session-a', previous, outbox, store), true)
assert.equal(loadChatOutbox(100, 'session-a', store).length, 3, 'offline outbox survives app restart')
assert.deepEqual(loadChatOutbox(100, 'session-b', store), [], 'no cross-session delivery')
assert.deepEqual(loadChatOutbox(200, 'session-a', store), [], 'no cross-user delivery')

// The first HTTP acknowledgement is lost. The saved request and clientId
// remain unchanged when the UI retries after reconnect, including on restart.
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
previous = outbox
outbox = confirmChatMessage(outbox, queued.clientId, queued.conversationId)
assert.equal(outbox.length, 2)
outbox = confirmChatMessage(outbox, queued.clientId, queued.conversationId)
assert.equal(outbox.length, 2, 'late realtime and HTTP receipts are both safe')
assert.equal(persistChatOutboxChange(100, 'session-a', previous, outbox, store), true)
assert.equal(loadChatOutbox(100, 'session-a', store).length, 2)
assert.equal(JSON.stringify([...storage]).includes('Bearer'), false)

// Per-message keys prevent a stale tab from overwriting another tab's work.
clearChatOutbox(100, store)
assert.equal(persistChatOutboxChange(100, 'session-a', [], [first], store), true)
assert.equal(persistChatOutboxChange(100, 'session-a', [], [second], store), true)
assert.deepEqual(loadChatOutbox(100, 'session-a', store).map(x => x.clientId),
  ['offline-1', 'offline-2'], 'independent tabs can append without clobbering')
assert.equal(persistChatOutboxChange(100, 'session-a', [first], [], store), true)
assert.deepEqual(loadChatOutbox(100, 'session-a', store).map(x => x.clientId),
  ['offline-2'], 'one tab only removes the message it acknowledged')

// Only safe upload metadata is kept, never temporary signed download URLs.
clearChatOutbox(100, store)
const withFile = {
  ...first, clientId: 'offline-file', text: '',
  attachments: [{ storageRef: 'chat/file/owned-ref', name: 'test.pdf',
    sizeBytes: 123, contentType: 'application/pdf', kind: 'file' }],
}
assert.equal(persistChatOutboxChange(100, 'session-a', [], [withFile], store), true)
assert.equal(loadChatOutbox(100, 'session-a', store)[0].attachments[0].storageRef, 'chat/file/owned-ref')
const withAccidentalURL = { ...withFile, attachments: [
  { ...withFile.attachments[0], url: 'https://secret.example/?signed=token' },
] }
assert.equal(persistChatOutboxChange(100, 'session-a', [withFile], [withAccidentalURL], store), true)
assert.equal(JSON.stringify([...storage]).includes('secret.example'), false,
  'Never persist a signed URL even when a caller accidentally supplies one')
clearChatOutbox(100, store)
assert.deepEqual(loadChatOutbox(100, 'session-a', store), [])
console.log('PASS: durable account outbox, multi-tab deltas, double-submit, lost-ACK resend, isolation, safe metadata')
