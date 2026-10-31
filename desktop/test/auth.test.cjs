'use strict'

// Unit fixtures verify boundaries, not live backend authentication or OS cryptography.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const { join } = require('node:path')
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto')
const { createCredentialVault, validCredential } = require('../src/auth-vault.cjs')
const { createAuthBroker } = require('../src/auth-broker.cjs')
const { registerAuthIPC } = require('../src/auth-ipc.cjs')
const ID = 'a7ce5309-8fb5-4f57-861c-ef54c75db291'
const OTHER = '72b44e97-1524-47cd-b77d-0ee59a721947'
const credential = () => ({ version: 1, sessionId: ID, userId: 7, refreshToken: 'r'.repeat(43) })
const data = () => ({ token: 'unit-access', refreshToken: 'r'.repeat(43), privateField: 'not-public',
  user: { id: 7, email: 'unit@example.test', username: 'unit', displayName: 'Unit', internal: 'private' } })
const json = (value = data(), status = 200) => Response.json(value, { status })
const verify = () => ({ token: 'v'.repeat(43), code: '123456' })
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }
function fixture(initial = credential(), transport = async () => json()) {
  let saved = initial
  const requests = [], expired = []
  const vault = { available() {}, read: () => saved, write: (value) => { saved = value }, clear: () => { saved = null } }
  const broker = createAuthBroker({ vault, baseURL: 'https://api-chat.codelocal.cloud',
    fetchImpl: async (url, init) => { requests.push({ url, init }); return transport(url, init) },
    onExpired: (id) => expired.push(id) })
  return { broker, vault, requests, expired, saved: () => saved }
}
function cryptoFixture() {
  const key = randomBytes(32)
  return {
    isEncryptionAvailable: () => true,
    encryptString(text) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
      const bytes = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), bytes])
    },
    decryptString(bytes) {
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
      cipher.setAuthTag(bytes.subarray(12, 28))
      return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8')
    },
  }
}
function temporary(t) {
  const directory = fs.mkdtempSync(join(os.tmpdir(), 'soco-vault-unit-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return directory
}

test('vault schema rejects coerced IDs and unknown fields', () => {
  assert.equal(validCredential(credential()), true)
  for (const value of [{ sessionId: [ID] }, { token: 'access' }, { refreshToken: 'bad' }, { userId: -1 }]) {
    assert.equal(validCredential({ ...credential(), ...value }), false)
  }
})
test('encrypted vault roundtrip uses atomic private file and idempotent deletion', (t) => {
  const directory = temporary(t), crypto = cryptoFixture()
  const vault = createCredentialVault(directory, crypto, 'darwin')
  assert.equal(vault.read(), null)
  vault.write(credential())
  const bytes = fs.readFileSync(join(directory, 'session.bin'))
  assert.equal(bytes.includes(Buffer.from(credential().refreshToken)), false)
  assert.equal(bytes.includes(Buffer.from(ID)), false)
  assert.deepEqual(createCredentialVault(directory, crypto, 'darwin').read(), credential())
  assert.deepEqual(fs.readdirSync(directory), ['session.bin'])
  if (process.platform !== 'win32') assert.equal(fs.statSync(join(directory, 'session.bin')).mode & 0o777, 0o600)
  vault.clear(); vault.clear(); assert.equal(vault.read(), null)
})
test('unavailable encryption has no plaintext fallback', (t) => {
  const directory = temporary(t)
  assert.throws(() => createCredentialVault(directory, { isEncryptionAvailable: () => false }, 'darwin').write(credential()), /VAULT_UNAVAILABLE/)
  assert.deepEqual(fs.readdirSync(directory), [])
  assert.throws(() => createCredentialVault(directory, cryptoFixture(), 'linux').available(), /VAULT_UNAVAILABLE/)
})
test('corrupted and oversized vault files fail closed', (t) => {
  const directory = temporary(t), vault = createCredentialVault(directory, cryptoFixture(), 'darwin')
  fs.writeFileSync(join(directory, 'session.bin'), 'corrupt')
  assert.throws(() => vault.read(), /VAULT_INVALID/)
  fs.writeFileSync(join(directory, 'session.bin'), Buffer.alloc(16385))
  assert.throws(() => vault.read(), /VAULT_UNREADABLE/)
})
test('symlink credential files are rejected', { skip: process.platform === 'win32' }, (t) => {
  const directory = temporary(t)
  fs.writeFileSync(join(directory, 'other'), 'data')
  fs.symlinkSync(join(directory, 'other'), join(directory, 'session.bin'))
  assert.throws(() => createCredentialVault(directory, cryptoFixture(), 'darwin').read(), /VAULT_UNREADABLE/)
})
test('login returns only public session; restart preserves outbox scope', async () => {
  const f = fixture(null), session = await f.broker.verifyEmail(verify())
  assert.deepEqual(Object.keys(session).sort(), ['sessionId', 'token', 'user'])
  assert.deepEqual(Object.keys(session.user).sort(), ['displayName', 'email', 'id', 'username'])
  assert.equal(JSON.stringify(session).includes('refreshToken'), false)
  assert.equal(f.saved().token, undefined)
  const restarted = createAuthBroker({ vault: f.vault, baseURL: 'https://api-chat.codelocal.cloud', fetchImpl: async () => json() })
  assert.equal((await restarted.restore()).sessionId, session.sessionId)
  assert.equal(f.requests[0].init.redirect, 'error')
  assert.equal(f.requests[0].init.credentials, 'omit')
})
test('concurrent restoration is single-flight', async () => {
  const gate = deferred(), f = fixture(credential(), () => gate.promise)
  const operations = Array.from({ length: 8 }, () => f.broker.restore())
  gate.resolve(json())
  assert.ok((await Promise.all(operations)).every((session) => session.sessionId === ID))
  assert.equal(f.requests.length, 1)
})
test('transient failures preserve durable credentials', async () => {
  for (const transport of [async () => { throw new Error('offline') }, async () => json({}, 503), async () => json({}, 429), async () => json({})]) {
    const f = fixture(credential(), transport)
    await assert.rejects(f.broker.restore(), /AUTH_/)
    assert.deepEqual(f.saved(), credential()); assert.deepEqual(f.expired, [])
  }
})
test('confirmed revocation clears vault and matching scope', async () => {
  const f = fixture(credential(), async () => json({}, 401))
  assert.equal(await f.broker.restore(), null)
  assert.equal(f.saved(), null); assert.deepEqual(f.expired, [ID])
  assert.equal(await f.broker.restore(), null); assert.equal(f.requests.length, 1)
})
test('late refresh cannot resurrect logout', async () => {
  const gate = deferred()
  const f = fixture(credential(), (url) => url.endsWith('/refresh') ? gate.promise : Promise.resolve(new Response(null, { status: 204 })))
  const refresh = f.broker.restore()
  assert.deepEqual(await f.broker.logout({ sessionId: ID, revoke: true }), { revoked: true })
  gate.resolve(json()); assert.equal(await refresh, null); assert.equal(f.saved(), null)
})
test('cancelled login revokes late server credential', async () => {
  const gate = deferred()
  const f = fixture(null, (url) => url.endsWith('/verify') ? gate.promise : Promise.resolve(new Response(null, { status: 204 })))
  const login = f.broker.verifyEmail(verify())
  await f.broker.logout({ sessionId: null, revoke: false }); gate.resolve(json())
  await assert.rejects(login, /AUTH_CANCELLED/)
  assert.equal(f.saved(), null); assert.equal(f.requests.filter((r) => r.url.endsWith('/logout')).length, 1)
})
test('unavailable vault prevents issuing a session', async () => {
  const f = fixture(null); f.vault.available = () => { throw new Error('VAULT_UNAVAILABLE') }
  await assert.rejects(f.broker.verifyEmail(verify()), /VAULT_UNAVAILABLE/); assert.equal(f.requests.length, 0)
})
test('vault read failure does not fall back to Web credentials', () => {
  const f = fixture(); f.vault.read = () => { throw new Error('VAULT_INVALID') }
  assert.throws(() => f.broker.restore(), /VAULT_INVALID/); assert.equal(f.requests.length, 0)
})
test('invalid input cannot choose endpoint or attach arbitrary fields', async () => {
  const f = fixture(null)
  for (const input of [null, [], {}, { ...verify(), baseURL: 'https://evil.test' }, { ...verify(), code: 123456 }]) {
    await assert.rejects(f.broker.verifyEmail(input), /AUTH_INVALID_REQUEST/)
  }
  assert.equal(f.requests.length, 0)
  assert.throws(() => createAuthBroker({ vault: f.vault, baseURL: 'https://evil.test' }), /AUTH_UNTRUSTED_ENDPOINT/)
})
test('offline logout reports revoke failure, not fabricated success', async () => {
  const f = fixture(credential(), async () => { throw new Error('offline') })
  assert.deepEqual(await f.broker.logout({ sessionId: ID, revoke: true }), { revoked: false }); assert.equal(f.saved(), null)
})
test('stale scope cannot revoke new session', async () => {
  const f = fixture()
  await assert.rejects(f.broker.logout({ sessionId: OTHER, revoke: true }), /AUTH_SESSION_CHANGED/)
  await assert.rejects(f.broker.manage(OTHER, 'list'), /AUTH_SESSION_CHANGED/)
  assert.deepEqual(f.saved(), credential()); assert.equal(f.requests.length, 0)
})
test('session management returns allowlisted fields only', async () => {
  const f = fixture(credential(), async () => json([{ id: OTHER, userAgent: 'test', createdAt: '', lastSeenAt: '', expiresAt: '', current: false, refreshToken: 'secret' }]))
  assert.equal((await f.broker.manage(ID, 'list'))[0].refreshToken, undefined)
  await assert.rejects(f.broker.manage(ID, 'revoke', '../../private'), /AUTH_INVALID_REQUEST/)
  assert.equal(f.requests.length, 1)
})
test('oversized response and cross-account renewal rejected', async () => {
  for (const value of [{ ...data(), padding: 'x'.repeat(70000) }, { ...data(), user: { ...data().user, id: 8 } }]) {
    const f = fixture(credential(), async () => json(value))
    await assert.rejects(f.broker.restore(), /AUTH_INVALID_RESPONSE/); assert.deepEqual(f.saved(), credential())
  }
})
test('failed durable login write revokes issued credential', async () => {
  const f = fixture(null, async (url) => url.endsWith('/logout') ? new Response(null, { status: 204 }) : json())
  f.vault.write = () => { throw new Error('VAULT_WRITE_FAILED') }
  await assert.rejects(f.broker.verifyEmail(verify()), /VAULT_WRITE_FAILED/)
  assert.equal(f.saved(), null); assert.ok(f.requests.at(-1).url.endsWith('/logout'))
})
test('local deletion failure must still attempt server revocation', async () => {
  const f = fixture(credential(), async () => new Response(null, { status: 204 }))
  f.vault.clear = () => { throw new Error('VAULT_CLEAR_FAILED') }
  await assert.rejects(f.broker.logout({ sessionId: ID, revoke: true }), /VAULT_CLEAR_FAILED/)
  assert.equal(f.requests.filter((r) => r.url.endsWith('/logout')).length, 1)
  assert.throws(() => f.broker.refresh(ID), /AUTH_SESSION_CHANGED/)
})
test('late session list cannot cross logout', async () => {
  const gate = deferred(), f = fixture(credential(), () => gate.promise)
  const request = f.broker.manage(ID, 'list'); await f.broker.logout({ sessionId: ID, revoke: false })
  gate.resolve(json([])); await assert.rejects(request, /AUTH_SESSION_CHANGED/)
})
test('all auth IPC handlers reject foreign frame and excess arguments', async () => {
  const handlers = new Map(), trusted = {}, f = fixture()
  registerAuthIPC({ handle: (name, handler) => handlers.set(name, handler) }, f.broker, (event) => event === trusted)
  assert.equal(handlers.size, 7)
  for (const handler of handlers.values()) {
    await assert.rejects(handler({}), /Forbidden IPC origin/)
    await assert.rejects(handler(trusted, 1, 2, 3, 4), /AUTH_INVALID_REQUEST/)
  }
  assert.equal(f.requests.length, 0)
})
test('IPC errors never serialize internal paths or response bodies', async () => {
  const handlers = new Map()
  registerAuthIPC({ handle: (name, handler) => handlers.set(name, handler) }, { restore: () => { throw new Error('/private/path secret') } }, () => true)
  await assert.rejects(handlers.get('soco:auth:restore')({}), { message: 'AUTH_UNAVAILABLE' })
})
