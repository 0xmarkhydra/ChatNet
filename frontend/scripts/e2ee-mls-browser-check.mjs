// Real Chrome/Chromium MLS handshake in two independent browser realms.
// Disabled product integration; no real ChatNet backend data is touched.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const vite = await createServer({
  root: projectRoot,
  configFile: false,
  clearScreen: false,
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{
    name: 'temporary-e2ee-smoke-route',
    configureServer(server) {
      server.middlewares.use('/__e2ee_test_only__', (_req, response) => {
        response.setHeader('Content-Type', 'text/html; charset=utf-8')
        response.end('<!doctype html><meta charset="utf-8"><title>ChatNet MLS browser PoC</title>')
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
})
let browser
try {
  await vite.listen()
  const serverUrl = vite.resolvedUrls?.local[0]
  if (!serverUrl) throw new Error('Vite test URL not resolved')
  browser = await chromium.launch({ headless: true })
  const a = await browser.newPage()
  const b = await browser.newPage()
  await Promise.all([
    a.goto(serverUrl + '__e2ee_test_only__'),
    b.goto(serverUrl + '__e2ee_test_only__'),
  ])
  const create = async (page, userId) => page.evaluate(async uid => {
    const engine = await import('/src/features/chat/lib/mlsEngineExperimental.ts')
    const suite = await engine.createExperimentalMLSCiphersuite()
    const device = await engine.createExperimentalMLSDevice(uid, crypto.randomUUID(), suite)
    const trust = new engine.ExperimentalMLSTrust()
    window.__poc = { engine, suite, device, trust }
    return {
      userId: uid, deviceId: device.deviceId,
      mlsSigningKey: [...device.publicPackage.leafNode.signaturePublicKey],
      package: [...device.keyPackageBytes],
    }
  }, userId)
  const alice = await create(a, 402)
  const bob = await create(b, 403)
  const trust = async (page, member) => page.evaluate(peer => {
    window.__poc.trust.authorize(peer.userId, peer.deviceId, new Uint8Array(peer.mlsSigningKey))
  }, member)
  // The PoC supplies public keys out of band. Production MUST verify these
  // bindings against signed device-key attestations or a safety number.
  await Promise.all([trust(a, alice), trust(a, bob), trust(b, alice), trust(b, bob)])
  const conversationId = 9001
  const welcome = await a.evaluate(async ({ conversationId, peer }) => {
    const { engine, suite, device, trust } = window.__poc
    const group = await engine.createExperimentalMLSGroup(conversationId, device, suite, trust)
    const added = await engine.addExperimentalMLSDevice(
      group, new Uint8Array(peer.package), peer.userId, peer.deviceId, trust,
    )
    window.__poc.group = added.next
    return { welcome: [...added.welcome], commit: [...added.commit], epoch: added.epoch }
  }, { conversationId, peer: bob })
  assert.equal(welcome.epoch, 1)
  await b.evaluate(async ({ conversationId, welcome }) => {
    const { engine, suite, device, trust } = window.__poc
    window.__poc.group = await engine.joinExperimentalMLSGroup(
      conversationId, device, new Uint8Array(welcome), suite, trust,
    )
  }, { conversationId, welcome: welcome.welcome })

  const original = 'Mã hóa MLS trực tiếp trên Chrome, hai client độc lập 🤝'
  const encrypted = await a.evaluate(async message => {
    const { engine } = window.__poc
    const result = await engine.encryptExperimentalMLSMessage(
      window.__poc.group, new TextEncoder().encode(message),
    )
    window.__poc.group = result.next
    return [...result.ciphertext]
  }, original)
  assert.equal(Buffer.from(encrypted).includes(Buffer.from(original)), false)
  const recovered = await b.evaluate(async ciphertext => {
    const { engine } = window.__poc
    const result = await engine.receiveExperimentalMLSMessage(
      window.__poc.group, new Uint8Array(ciphertext),
    )
    window.__poc.group = result.next
    return new TextDecoder().decode(result.plaintext)
  }, encrypted)
  assert.equal(recovered, original)
  const replayRejected = await b.evaluate(async ciphertext => {
    const { engine } = window.__poc
    try {
      await engine.receiveExperimentalMLSMessage(
        window.__poc.group, new Uint8Array(ciphertext),
      )
      return false
    } catch {
      return true
    }
  }, encrypted)
  assert.equal(replayRejected, true)
  console.log('PASS real Chromium: two independent browser clients, MLS KeyPackage -> Commit -> Welcome -> encrypted/decrypted message, replay rejected')
} finally {
  await browser?.close()
  await vite.close()
}
