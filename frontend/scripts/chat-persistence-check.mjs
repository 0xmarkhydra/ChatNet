import assert from 'node:assert/strict'
import { canMarkConversationRead } from '../src/features/chat/conversationRead.ts'
import {
  clearChatPersistence, clearPendingSend, loadChatDrafts,
  loadPendingSend, saveChatDrafts, savePendingSend,
} from '../src/features/chat/chatPersistence.ts'

const items = new Map()
const store = {
  getItem: (key) => items.get(key) ?? null,
  setItem: (key, value) => { items.set(key, String(value)) },
  removeItem: (key) => { items.delete(key) },
}
const draft = { 41: { text: 'Tin nhắn riêng của A' }, 42: { text: 'Xin chào 🌏' } }
saveChatDrafts(100, draft, store)
assert.deepEqual(loadChatDrafts(100, store), draft)
assert.deepEqual(loadChatDrafts(200, store), {}, 'Cross-account draft isolation')
assert.equal(JSON.stringify([...items]).includes('access-token'), false)

saveChatDrafts(100, { 41: { text: '' } }, store)
assert.deepEqual(loadChatDrafts(100, store), {}, 'Remove empty drafts')

const previous = {
  sessionId: 'session-a',
  conversationId: 41,
  signature: JSON.stringify({ text: 'hello', attachments: [], replyToMessageId: null }),
  clientId: 'b74d40ed-9811-42e9-8d16-1ed880356ac1',
}
savePendingSend(100, previous, store, 1000)
assert.equal(loadPendingSend(100, 'session-a', store, 1500)?.clientId, previous.clientId)
assert.equal(loadPendingSend(200, 'session-a', store, 1500), null)
assert.equal(loadPendingSend(100, 'session-b', store, 1500), null, 'New login cannot reuse prior id')
assert.equal(loadPendingSend(100, 'session-a', store, 1000 + 25 * 60 * 60 * 1000), null, 'Expired receipts are ignored')
clearPendingSend(100, 'wrong-id', store)
assert.notEqual(loadPendingSend(100, 'session-a', store, 1500), null)
clearPendingSend(100, previous.clientId, store)
assert.equal(loadPendingSend(100, 'session-a', store, 1500), null)

store.setItem('chatnet:drafts:v1:100', '{malformed json')
assert.deepEqual(loadChatDrafts(100, store), {}, 'Corrupted drafts fail safely')
store.setItem('chatnet:drafts:v1:100', JSON.stringify({ '__proto__': { text: 'attack' }, '-1': { text: 'bad' }, 4: { text: 'safe' } }))
assert.deepEqual(loadChatDrafts(100, store), { 4: { text: 'safe' } }, 'Only positive numeric conversation IDs')

saveChatDrafts(100, draft, store)
savePendingSend(100, previous, store, 2000)
clearChatPersistence(100, store)
assert.deepEqual(loadChatDrafts(100, store), {})
assert.equal(loadPendingSend(100, 'session-a', store, 2500), null)

const deniedStore = { getItem: () => { throw Error('denied') }, setItem: () => { throw Error('denied') }, removeItem: () => { throw Error('denied') } }
assert.deepEqual(loadChatDrafts(100, deniedStore), {})
assert.equal(loadPendingSend(100, 'session-a', deniedStore), null)
saveChatDrafts(100, draft, deniedStore)
savePendingSend(100, previous, deniedStore)
clearChatPersistence(100, deniedStore)

assert.equal(canMarkConversationRead(42, 42, 'chat', 'visible'), true)
assert.equal(canMarkConversationRead(42, 42, 'chat', 'hidden'), false, 'Background PWA must not mark read')
assert.equal(canMarkConversationRead(42, 42, 'feed', 'visible'), false, 'Hidden chat tab must not mark read')
assert.equal(canMarkConversationRead(42, 43, 'chat', 'visible'), false, 'Other conversation must stay unread')
assert.equal(canMarkConversationRead(null, 42, 'chat', 'visible'), false, 'No open conversation stays unread')

console.log('PASS: chat drafts, lost-ACK recovery, account isolation, read visibility, expiry, denied storage and logout')
