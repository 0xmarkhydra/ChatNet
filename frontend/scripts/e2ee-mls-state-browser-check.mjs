import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const vite = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  configFile: false,
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{
    name: 'temporary-mls-state-vault-test',
    configureServer(server) {
      server.middlewares.use('/__mls_vault_test__', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end('<!doctype html><meta charset="utf-8"><title>MLS vault test</title>')
      })
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
})
let browser
try {
  await vite.listen()
  const url = vite.resolvedUrls?.local[0] + '__mls_vault_test__'
  browser = await chromium.launch({ headless: true })
  const a = await browser.newPage()
  const b = await browser.newPage()
  await Promise.all([a.goto(url), b.goto(url)])

  const bob = await b.evaluate(async () => {
    const engine = await import('/src/features/chat/lib/mlsEngineExperimental.ts')
    const suite = await engine.createExperimentalMLSCiphersuite()
    const device = await engine.createExperimentalMLSDevice(902, crypto.randomUUID(), suite)
    const trust = new engine.ExperimentalMLSTrust()
    trust.authorize(902, device.deviceId, device.publicPackage.leafNode.signaturePublicKey)
    window.__poc = { engine, suite, trust, device }
    return {
      userId: device.userId, deviceId: device.deviceId,
      keyPackage: [...device.keyPackageBytes],
      signingKey: [...device.publicPackage.leafNode.signaturePublicKey],
    }
  })
  const alice = await a.evaluate(async peer => {
    const engine = await import('/src/features/chat/lib/mlsEngineExperimental.ts')
    const vault = await import('/src/features/chat/lib/mlsStateVault.ts')
    const suite = await engine.createExperimentalMLSCiphersuite()
    const device = await engine.createExperimentalMLSDevice(901, crypto.randomUUID(), suite)
    const trust = new engine.ExperimentalMLSTrust()
    trust.authorize(901, device.deviceId, device.publicPackage.leafNode.signaturePublicKey)
    trust.authorize(peer.userId, peer.deviceId, new Uint8Array(peer.signingKey))
    const initial = await engine.createExperimentalMLSGroup(7081, device, suite, trust)
    const upgraded = await engine.addExperimentalMLSDevice(
      initial, new Uint8Array(peer.keyPackage), peer.userId, peer.deviceId, trust,
    )
    const rev1 = await vault.saveMLSState(device.userId, device.deviceId, 7081, upgraded.next.state, 0)
    window.__poc = { engine, suite, trust, device, group: upgraded.next, rev: rev1 }
    return {
      signingKeyLength: upgraded.next.state.signaturePrivateKey.length,
      signingKeyHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
        upgraded.next.state.signaturePrivateKey))),
      userId: device.userId, deviceId: device.deviceId,
      signingKey: [...device.publicPackage.leafNode.signaturePublicKey],
      welcome: [...upgraded.welcome],
      revision: rev1,
    }
  }, bob)
  assert.equal(alice.revision, 1)

  await b.evaluate(async peer => {
    const { engine, suite, device, trust } = window.__poc
    trust.authorize(peer.userId, peer.deviceId, new Uint8Array(peer.signingKey))
    const group = await engine.joinExperimentalMLSGroup(7081, device,
      new Uint8Array(peer.welcome), suite, trust)
    const vault = await import('/src/features/chat/lib/mlsStateVault.ts')
    const revision = await vault.saveMLSState(device.userId, device.deviceId, 7081, group.state, 0)
    window.__poc.group = group
    window.__poc.rev = revision
  }, alice)

  // Lose all JS references and reload both pages.
  await Promise.all([a.reload(), b.reload()])
  const sender = await a.evaluate(async account => {
    const engine = await import('/src/features/chat/lib/mlsEngineExperimental.ts')
    const vault = await import('/src/features/chat/lib/mlsStateVault.ts')
    const trust = new engine.ExperimentalMLSTrust()
    const saved = await vault.loadMLSState(account.userId, account.deviceId, 7081, trust.config)
    if (!saved || saved.revision !== 1 || saved.state.groupContext.epoch !== 1n) {
      throw new Error('MLS state missing after reload')
    }
    if (saved.state.signaturePrivateKey.length !== account.signingKeyLength) {
      throw new Error('Restored MLS Ed25519 signing key length mismatch: expected=' +
        account.signingKeyLength + ' actual=' + saved.state.signaturePrivateKey.length)
    }
    const signingHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
      saved.state.signaturePrivateKey)))
    if (JSON.stringify(signingHash) !== JSON.stringify(account.signingKeyHash)) {
      throw new Error('MLS stored private signing key changed during serialization')
    }
    window.__poc = { engine, vault, trust, group: {
      state: saved.state, suite: await engine.createExperimentalMLSCiphersuite(),
    }, revision: saved.revision }
    const output = await engine.encryptExperimentalMLSMessage(
      window.__poc.group, new TextEncoder().encode('Encrypted after both pages reloaded'),
    )
    window.__poc.group = output.next
    window.__poc.revision = await vault.saveMLSState(
      account.userId, account.deviceId, 7081, output.next.state, saved.revision,
    )
    let staleRejected = false
    try {
      await vault.saveMLSState(account.userId, account.deviceId, 7081, output.next.state, saved.revision)
    } catch { staleRejected = true }
    if (!staleRejected) throw new Error('Stale MLS state writer was accepted')
    return { ciphertext: [...output.ciphertext], revision: window.__poc.revision }
  }, alice)
  assert.equal(sender.revision, 2)

  const message = await b.evaluate(async ({ account, ciphertext }) => {
    const engine = await import('/src/features/chat/lib/mlsEngineExperimental.ts')
    const vault = await import('/src/features/chat/lib/mlsStateVault.ts')
    const trust = new engine.ExperimentalMLSTrust()
    const saved = await vault.loadMLSState(account.userId, account.deviceId, 7081, trust.config)
    if (!saved) throw new Error('Bob MLS state missing after reload')
    const suite = await engine.createExperimentalMLSCiphersuite()
    const decrypted = await engine.receiveExperimentalMLSMessage(
      { state: saved.state, suite }, new Uint8Array(ciphertext),
    )
    await vault.saveMLSState(account.userId, account.deviceId, 7081, decrypted.next.state, saved.revision)
    const noCrossAccount = await vault.loadMLSState(account.userId + 3, account.deviceId, 7081, trust.config)
    if (noCrossAccount !== null) throw new Error('Cross-account key leakage')
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('chatnet-mls-state-v1')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const key = await new Promise((resolve, reject) => {
      const request = db.transaction('keys', 'readonly').objectStore('keys')
        .get(account.userId + ':' + account.deviceId)
      request.onsuccess = () => resolve(request.result?.cryptoKey)
      request.onerror = () => reject(request.error)
    })
    if (!key || key.extractable) throw new Error('Local MLS AES-GCM wrapping key is exportable/missing')
    let exportRejected = false
    try { await crypto.subtle.exportKey('raw', key) } catch { exportRejected = true }
    if (!exportRejected) throw new Error('MLS vault master key was exportable')
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('groups', 'readwrite')
      const store = transaction.objectStore('groups')
      const request = store.get(account.userId + ':' + account.deviceId + ':7081')
      request.onsuccess = () => {
        const current = request.result
        const altered = new Uint8Array(current.ciphertext)
        altered[altered.length - 1] ^= 1
        store.put({ ...current, ciphertext: altered.buffer })
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    let tamperRejected = false
    try { await vault.loadMLSState(account.userId, account.deviceId, 7081, trust.config) }
    catch { tamperRejected = true }
    if (!tamperRejected) throw new Error('Tampered encrypted MLS state was accepted')
    return new TextDecoder().decode(decrypted.plaintext)
  }, { account: bob, ciphertext: sender.ciphertext })
  assert.equal(message, 'Encrypted after both pages reloaded')
  console.log('PASS Chromium: encrypted MLS state persisted across reload for two clients, ratchet restored, stale write rejected, accounts isolated')
} finally {
  await browser?.close()
  await vite.close()
}
