import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { chromium, webkit } from 'playwright'
import ts from 'typescript'

const source = readFileSync(new URL('../src/features/auth/lib/e2eeKeyStore.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<!doctype html><title>E2EE isolated key storage test</title>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await (process.argv.includes('--webkit') ? webkit : chromium).launch({ headless: true })
  const page = await browser.newPage()
  const address = server.address()
  await page.goto(`http://127.0.0.1:${address.port}/`)
  const saved = await page.evaluate(async script => {
    const url = URL.createObjectURL(new Blob([script], { type: 'application/javascript' }))
    try {
      const store = await import(url)
      const pair = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify'])
      const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
      const publicKey = btoa(String.fromCharCode(...publicRaw))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const deviceId = crypto.randomUUID()
      await store.saveLocalE2EEIdentity(42, { deviceId, publicKey, privateKey: pair.privateKey })
      return { deviceId, publicKey }
    } finally {
      URL.revokeObjectURL(url)
    }
  }, compiled)

  // The JavaScript realm and all in-memory CryptoKey references are discarded.
  await page.reload()

  const result = await page.evaluate(async ({ script, saved: entry }) => {
    const url = URL.createObjectURL(new Blob([script], { type: 'application/javascript' }))
    try {
      const store = await import(url)
      const loaded = await store.loadLocalE2EEIdentity(42, entry.deviceId)
      if (!loaded || loaded.publicKey !== entry.publicKey || loaded.privateKey.extractable) {
        throw new Error('Private signing key missing after page reload or exportable')
      }
      const publicKey = await crypto.subtle.importKey(
        'raw',
        Uint8Array.from(atob(entry.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
          char => char.charCodeAt(0)),
        'Ed25519', false, ['verify'],
      )
      const data = new TextEncoder().encode('browser key survives a real page reload')
      const sig = await crypto.subtle.sign('Ed25519', loaded.privateKey, data)
      if (!await crypto.subtle.verify('Ed25519', publicKey, sig, data)) {
        throw new Error('Recovered device key does not sign correctly')
      }
      if (await store.loadLocalE2EEIdentity(43, entry.deviceId) !== null) {
        throw new Error('Cross-account identity access')
      }
      const devices = await store.listLocalE2EEDeviceIDs(42)
      if (devices.length !== 1 || devices[0] !== entry.deviceId) {
        throw new Error('Own identity listing failed')
      }
      let duplicateRejected = false
      try {
        await store.saveLocalE2EEIdentity(42, {
          deviceId: entry.deviceId, publicKey: entry.publicKey, privateKey: loaded.privateKey,
        })
      } catch { duplicateRejected = true }
      if (!duplicateRejected) throw new Error('Existing private identity overwritten')
      await store.deleteLocalE2EEIdentity(42, entry.deviceId)
      if (await store.loadLocalE2EEIdentity(42, entry.deviceId) !== null) {
        throw new Error('Deleted private identity remains available')
      }
      return { duplicateRejected, keyExtractable: loaded.privateKey.extractable, verified: true }
    } finally {
      URL.revokeObjectURL(url)
    }
  }, { script: compiled, saved })
  assert.equal(result.verified, true)
  assert.equal(result.duplicateRejected, true)
  assert.equal(result.keyExtractable, false)
  console.log('PASS ' + (process.argv.includes('--webkit') ? 'WebKit' : 'Chromium') +
    ' IndexedDB: non-exportable Ed25519 survives page reload, account isolation, duplicate protection and deletion')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
