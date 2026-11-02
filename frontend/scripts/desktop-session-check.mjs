import assert from 'node:assert/strict'
import { createSessionClient } from '../src/features/auth/session.ts'
import { configureChatPersistenceStore, saveChatDrafts, loadChatDrafts, clearChatPersistence } from '../src/features/chat/chatPersistence.ts'
import { persistChatOutboxChange, loadChatOutbox, clearChatOutbox } from '../src/chatOutbox.ts'

// Contract/unit tests. Injected transport is not evidence of a real login or delivered message.
const ID = 'a7ce5309-8fb5-4f57-861c-ef54c75db291'
const jwt = (seconds) => `header.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + seconds })).toString('base64url')}.signature`
const initial = () => ({ token: jwt(-60), sessionId: ID, user: { id: 7, email: 'unit@example.test', username: 'unit', displayName: 'Unit' } })
function fixture(renew) {
  let current = initial(), expired = 0
  const client = createSessionClient('https://local.test', {
    get: () => current, save: (next) => { current = next }, expire: () => { current = null; expired++ },
  }, { refresh: renew })
  return { client, get: () => current, set: (next) => { current = next }, expired: () => expired }
}
const originalFetch = globalThis.fetch
try {
  let renewals = 0, reads = 0, checks = 0
  const f = fixture(async (id) => {
    assert.equal(id, ID); renewals++
    await new Promise((resolve) => setTimeout(resolve, 5))
    return { ...initial(), token: jwt(3600) }
  })
  globalThis.fetch = async (url, init) => {
    assert.equal(url.endsWith('/refresh'), false, 'renderer must never refresh through HTTP')
    if (url.endsWith('/session/status')) { checks++; return new Response(null, { status: 204 }) }
    assert.equal(init.headers.get('Authorization'), `Bearer ${f.get().token}`)
    reads++; return Response.json({ fixture: true })
  }
  await Promise.all(Array.from({ length: 8 }, () => f.client.request('/api/conversations', {}, ID)))
  assert.equal(renewals, 1); assert.equal(reads, 8)
  assert.equal(f.get().refreshToken, undefined)
  await f.client.request('/api/conversations/1/read', { method: 'POST' }, ID)
  assert.equal(checks, 1, 'native mutations retain the authoritative session preflight')

  for (const result of [{ ...initial(), refreshToken: 'r'.repeat(43) }, { ...initial(), sessionId: 'another' }, { ...initial(), user: { ...initial().user, id: 8 } }]) {
    const invalid = fixture(async () => result), before = invalid.get()
    await assert.rejects(invalid.client.refresh())
    assert.equal(invalid.get(), before)
  }
  const offline = fixture(async () => { throw new Error('offline') }), before = offline.get()
  await assert.rejects(offline.client.refresh()); assert.equal(offline.get(), before)
  const revoked = fixture(async () => null)
  assert.equal(await revoked.client.refresh(), null); assert.equal(revoked.expired(), 1)

  let finish
  const stale = fixture(() => new Promise((resolve) => { finish = resolve }))
  const renewal = stale.client.refresh(); stale.set(null)
  finish({ ...initial(), token: jwt(3600) })
  assert.equal(await renewal, null); assert.equal(stale.get(), null)

  const live = fixture(async () => ({ ...initial(), token: jwt(3600) }))
  await live.client.refresh()
  globalThis.fetch = async () => new Response(null, { status: 401 })
  assert.equal(await live.client.check(), false); assert.equal(live.get(), null)
} finally { globalThis.fetch = originalFetch }

class MemoryStorage {
  data = new Map()
  get length() { return this.data.size }
  key(index) { return [...this.data.keys()][index] ?? null }
  getItem(key) { return this.data.get(key) ?? null }
  setItem(key, value) { this.data.set(key, String(value)) }
  removeItem(key) { this.data.delete(key) }
}
const store = new MemoryStorage()
configureChatPersistenceStore(store)
saveChatDrafts(7, { 42: { text: 'persistent desktop draft' } })
const reopened = new MemoryStorage(); reopened.data = new Map(store.data)
configureChatPersistenceStore(reopened)
assert.equal(loadChatDrafts(7)[42].text, 'persistent desktop draft')
assert.deepEqual(loadChatDrafts(8), {})
clearChatPersistence(7); assert.deepEqual(loadChatDrafts(7), {})
const message = { clientId: 'unit-client-1', conversationId: 42, text: 'queued', attachments: [], createdAt: new Date().toISOString(), status: 'unconfirmed' }
assert.equal(persistChatOutboxChange(7, ID, [], [message], reopened), true)
reopened.setItem('chatnet:outbox:v2:7:corrupt', '{bad')
assert.deepEqual(loadChatOutbox(7, ID, reopened), [message], 'one corrupt entry must not hide other messages')
assert.deepEqual(loadChatOutbox(7, 'other-session', reopened), [])
assert.deepEqual(loadChatOutbox(8, ID, reopened), [])
clearChatOutbox(7, reopened); assert.deepEqual(loadChatOutbox(7, ID, reopened), [])
console.log('PASS: native refresh contract, single-flight, no renderer refresh HTTP, auth preflight, stale logout, expiry, persistent drafts and corrupt-item outbox isolation (unit tests).')
