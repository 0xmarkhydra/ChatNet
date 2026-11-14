// End-to-end two-browser MLS pilot service smoke via an isolated in-memory
// HTTP fixture. Backend PostgreSQL/Redis tests verify the real API separately.
// No user credentials, production data, external services or mock crypto.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const members = new Set([401, 402])
const deviceMap = new Map()
const challengeMap = new Map()
const packages = []
const consents = new Map()
const events = []
let epoch = 0
let nextID = 1
let failOneApplicationACK = false
const stats = { bootstraps: 0, applications: 0, duplicateApplications: 0 }

const json = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}
const uuid = () => crypto.randomUUID()
const appendEvent = (userId, input) => {
  const existing = events.find(e => e.senderId === userId && e.clientId === input.clientId)
  if (existing) return { id: existing.id, duplicate: true }
  const event = { ...input, id: nextID++, senderId: userId, conversationId: 501,
    createdAt: new Date().toISOString() }
  events.push(event)
  return { id: event.id, duplicate: false }
}

async function handleAPI(req, res) {
  const parsed = new URL(req.url, 'http://localhost')
  const userId = Number(req.headers['x-test-user'])
  if (!members.has(userId)) return json(res, 401, { error: 'unauthorized' })
  const path = parsed.pathname
  if (req.method === 'GET' && path === '/api/conversations/501/e2ee/status') {
    return json(res, 200, { mode: epoch === 0 ? 'legacy' : 'e2ee', epoch, pilotEnabled: true })
  }
  if (req.method === 'GET' && path === '/api/auth/e2ee/devices') {
    return json(res, 200, [...deviceMap.values()].filter(d => d.userId === userId)
      .map(({ deviceId, identityKey }) => ({ deviceId, identityKey, label: 'Web', createdAt: new Date().toISOString() })))
  }
  if (req.method === 'GET' && /^\/api\/auth\/e2ee\/users\/\d+\/devices$/.test(path)) {
    const target = Number(path.split('/')[5])
    if (!members.has(target)) return json(res, 403, { error: 'member' })
    return json(res, 200, [...deviceMap.values()].filter(d => d.userId === target)
      .map(({ deviceId, identityKey }) => ({ deviceId, identityKey, label: 'Web', createdAt: new Date().toISOString() })))
  }
  if (req.method === 'POST' && path === '/api/auth/e2ee/challenge') {
    const data = { challenge: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
      sessionId: uuid(), expiresInSeconds: 120 }
    challengeMap.set(userId, data)
    return json(res, 200, data)
  }

  let body
  if (req.method === 'POST') {
    try {
      let raw = ''
      for await (const chunk of req) {
        raw += chunk.toString('utf8')
        if (raw.length > 420000) return json(res, 413, { error: 'too large' })
      }
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return json(res, 400, { error: 'invalid body' })
    }
  }
  if (req.method === 'POST' && path === '/api/auth/e2ee/devices') {
    if (!challengeMap.has(userId) || body.challenge !== challengeMap.get(userId).challenge) {
      return json(res, 403, { error: 'challenge' })
    }
    deviceMap.set(body.deviceId, { deviceId: body.deviceId, identityKey: body.identityKey, userId })
    return json(res, 201, { ...body, createdAt: new Date().toISOString() })
  }
  if (req.method === 'POST' && path === '/api/auth/e2ee/key-packages') {
    if (!deviceMap.has(body.deviceId) ||
        deviceMap.get(body.deviceId).userId !== userId ||
        body.challenge !== challengeMap.get(userId)?.challenge) {
      return json(res, 403, { error: 'key challenge' })
    }
    const claimable = { ...body, userId, sessionId: challengeMap.get(userId).sessionId,
      expiresAt: new Date(Date.now()+86400000).toISOString() }
    packages.push(claimable)
    return json(res, 201, claimable)
  }
  if (req.method === 'POST' && path === '/api/auth/e2ee/key-packages/claim') {
    if (body.userId === userId) return json(res, 403, { error: 'self-claim' })
    const index = packages.findIndex(p => p.userId === body.userId && p.deviceId === body.deviceId)
    if (index < 0) return json(res, 404, { error: 'no package' })
    const [item] = packages.splice(index, 1)
    return json(res, 200, item)
  }
  if (req.method === 'GET' && path === '/api/conversations/501/e2ee/consents') {
    return json(res, 200, {
      ownApproved: consents.has(userId),
      peerApproved: consents.has(userId === 401 ? 402 : 401),
    })
  }
  if (req.method === 'POST' && path === '/api/conversations/501/e2ee/consents') {
    if (deviceMap.get(body.deviceId)?.userId !== userId || epoch !== 0) {
      return json(res, 403, { error: 'invalid user/device consent' })
    }
    consents.set(userId, body.deviceId)
    return json(res, 200, { approved: true })
  }
  if (req.method === 'POST' && path === '/api/conversations/501/e2ee/bootstrap') {
    const existing = events.find(e => e.clientId === body.commit.clientId)
    if (existing) {
      const welcome = events.find(e => e.clientId === body.welcome.clientId)
      return json(res, welcome ? 200 : 409,
        welcome ? { commitId: existing.id, welcomeId: welcome.id, duplicate: true } : { error: 'conflict' })
    }
    if (epoch !== 0 || deviceMap.size !== 2 ||
        consents.get(userId) !== body.commit.deviceId ||
        consents.get(userId === 401 ? 402 : 401) !== body.welcome.targetDeviceId ||
        !deviceMap.has(body.welcome.targetDeviceId) ||
        body.commit.deviceId !== body.welcome.deviceId ||
        body.commit.epoch !== 1 || body.welcome.epoch !== 1) {
      return json(res, 409, { error: 'invalid MLS bootstrap' })
    }
    epoch = 1
    const commit = appendEvent(userId, body.commit)
    const welcome = appendEvent(userId, body.welcome)
    stats.bootstraps++
    return json(res, 201, { commitId: commit.id, welcomeId: welcome.id })
  }
  if (req.method === 'POST' && path === '/api/conversations/501/e2ee/events') {
    if (epoch !== 1 || body.epoch !== 1 || body.eventType !== 'application' ||
        deviceMap.get(body.deviceId)?.userId !== userId) {
      return json(res, 409, { error: 'invalid E2EE epoch or sender' })
    }
    const output = appendEvent(userId, body)
    if (output.duplicate) stats.duplicateApplications++
    else stats.applications++
    // Simulate a lost ACK AFTER the server durably records the ciphertext.
    if (failOneApplicationACK) {
      failOneApplicationACK = false
      return json(res, 503, { error: 'lost ACK after commit' })
    }
    return json(res, output.duplicate ? 200 : 201,
      { id: output.id, epoch, duplicate: output.duplicate })
  }
  if (req.method === 'GET' && path === '/api/conversations/501/e2ee/events') {
    const deviceId = parsed.searchParams.get('deviceId')
    if (!deviceMap.has(deviceId) || deviceMap.get(deviceId).userId !== userId) {
      return json(res, 403, { error: 'not your device' })
    }
    const after = Number(parsed.searchParams.get('after') || 0)
    const limit = Number(parsed.searchParams.get('limit') || 25)
    const page = events.filter(e => e.id > after &&
      (e.eventType !== 'welcome' || e.targetDeviceId === deviceId))
      .slice(0, limit)
    return json(res, 200, {
      events: page, currentEpoch: epoch, nextAfter: page.at(-1)?.id ?? after,
    })
  }
  return json(res, 404, { error: 'not found' })
}

const vite = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  configFile: false, logLevel: 'error',
  optimizeDeps: { noDiscovery: false, include: ['react', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'] },
  plugins: [{
    name: 'isolated-e2ee-two-account-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          void handleAPI(req, res).catch(e => json(res, 500, { error: String(e) }))
        } else next()
      })
      server.middlewares.use('/__e2ee_pilot_test__', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end('<!doctype html><meta charset="utf-8"><title>ChatNet two-account MLS pilot</title>')
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
})
let browser
try {
  await vite.listen()
  const url = vite.resolvedUrls?.local[0] + '__e2ee_pilot_test__'
  browser = await chromium.launch({ headless: true })
  const alice = await browser.newPage()
  const bob = await browser.newPage()
  await Promise.all([alice.goto(url), bob.goto(url)])
  const create = async (page, uid, other) => {
    await page.evaluate(async ({ uid, other }) => {
      const { MLSPilotService } = await import('/src/features/chat/lib/mlsPilotService.ts')
      window.__pilot = new MLSPilotService((path, init = {}) =>
        fetch(path, { ...init, headers: {
          ...(init.headers || {}), 'X-Test-User': String(uid),
        } }), uid, other, 501)
    }, { uid, other })
  }
  await create(alice, 401, 402)
  await create(bob, 402, 401)
  const run = async (page, operation, ...params) => page.evaluate(
    async ({ operation, params }) => {
      const pilot = window.__pilot
      return pilot[operation](...params)
    }, { operation, params },
  )
  await run(alice, 'prepareDevice')
  await run(bob, 'prepareDevice')
  assert.equal(deviceMap.size, 2)
  // Test fixture supplies matching fingerprints out-of-band to the two users.
  await run(alice, 'confirmPeerIdentity')
  await run(bob, 'confirmPeerIdentity')
  await assert.rejects(() => run(alice, 'startConversation'),
    'MLS cutover requires explicit agreement by both participants')
  await run(alice, 'approvePilot')
  await assert.rejects(() => run(alice, 'startConversation'),
    'One consent is not sufficient to activate MLS')
  await run(bob, 'approvePilot')
  await run(alice, 'startConversation')
  assert.equal(epoch, 1)
  assert.equal(stats.bootstraps, 1)
  assert.deepEqual(events.map(e => e.eventType), ['commit', 'welcome'])
  await run(bob, 'sync')
  assert.equal(await run(bob, 'isReady'), true)
  await run(alice, 'send', 'Alice: Bonjour, đây là E2EE thật 🤝')
  let fromAlice = await run(bob, 'sync')
  assert.equal(fromAlice.length, 1)
  assert.match(fromAlice[0].text, /Alice: Bonjour/)
  await run(bob, 'send', 'Bob: đã nhận, khóa MLS hoạt động 🔐')
  let fromBob = await run(alice, 'sync')
  assert.equal(fromBob.length, 2)
  assert.match(fromBob[0].text, /Alice: Bonjour/)
  assert.match(fromBob[1].text, /Bob: đã nhận/)

  // Reload destroys all in-memory MLS states and CryptoKey references.
  await Promise.all([alice.reload(), bob.reload()])
  await create(alice, 401, 402)
  await create(bob, 402, 401)
  fromAlice = await run(bob, 'sync')
  fromBob = await run(alice, 'sync')
  assert.equal(fromAlice.length, 2)
  assert.equal(fromBob.length, 2)
  assert.equal(await run(alice, 'isReady'), true)
  assert.equal(await run(bob, 'isReady'), true)

  failOneApplicationACK = true
  await assert.rejects(() => run(alice, 'send', 'Alice: lost ACK must not re-encrypt twice'))
  const countAtFailure = stats.applications
  await alice.reload()
  await create(alice, 401, 402)
  await run(alice, 'flushPending')
  assert.equal(stats.applications, countAtFailure)
  assert.equal(stats.duplicateApplications, 1)
  fromAlice = await run(bob, 'sync')
  assert.equal(fromAlice.length, 3)
  assert.match(fromAlice[2].text, /lost ACK/)
  fromBob = await run(alice, 'sync')
  assert.equal(fromBob.length, 3)
  assert.deepEqual(fromAlice.map(x => x.text), fromBob.map(x => x.text))

  // The API may store ciphertext and metadata, but no message plaintext.
  assert.equal(events.filter(e => e.eventType === 'application').length, 3)
  const serverBodies = JSON.stringify(events)
  for (const phrase of ['Bonjour', 'đã nhận', 'lost ACK must not']) {
    assert.equal(serverBodies.includes(phrase), false, 'server saw plaintext: ' + phrase)
  }
  // Mount the actual React pilot panel, not just the underlying service.
  await Promise.all([
    alice.evaluate(() => import('/scripts/e2ee-pilot-test-entry.tsx')),
    bob.evaluate(() => import('/scripts/e2ee-pilot-test-entry.tsx')),
  ])
  await Promise.all([
    alice.evaluate(() => window.mountE2EEPilotTest(401, 402)),
    bob.evaluate(() => window.mountE2EEPilotTest(402, 401)),
  ])
  const field = alice.locator('#e2ee-ui-harness input[placeholder*="MLS"]')
  await field.waitFor({ timeout: 30000 })
  await field.fill('UI Chrome: E2EE reply from real React composer')
  await alice.locator('#e2ee-ui-harness button[aria-label="Gửi tin nhắn E2EE"]').click()
  await alice.waitForFunction(() =>
    document.querySelector('#e2ee-ui-harness .mls-pilot-thread')?.textContent
      ?.includes('UI Chrome: E2EE reply from real React composer'), { timeout: 30000 })
  await bob.waitForFunction(() =>
    document.querySelector('#e2ee-ui-harness .mls-pilot-thread')?.textContent
      ?.includes('UI Chrome: E2EE reply from real React composer'), { timeout: 30000 })
  assert.equal(events.filter(e => e.eventType === 'application').length, 4)
  await Promise.all([
    alice.evaluate(() => window.unmountE2EEPilotTest()),
    bob.evaluate(() => window.unmountE2EEPilotTest()),
  ])
  console.log('PASS real React Web pilot: encrypted send button, local display and remote receiver display')
  console.log('PASS two Chromium accounts: enroll/attest/pin, atomic MLS bootstrap, encrypted bidirectional chat, reload, lost ACK deduplication, ciphertext-only delivery')
} finally {
  await browser?.close()
  await vite.close()
}
