import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vite = await createServer({
  root, configFile: resolve(root, 'vite.config.ts'),
  logLevel: 'silent', server: { host: '127.0.0.1', port: 0 },
})
try {
  await vite.listen()
  const addr = vite.httpServer.address()
  const origin = 'http://127.0.0.1:' + addr.port
  const route = origin + '/__chatnet_s3_upload?url=' + encodeURIComponent('https://127.0.0.1/admin')
  const invalid = await fetch(route, {
    method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: Buffer.from('fake image'),
  })
  assert.equal(invalid.status, 403, 'Do not relay arbitrary destinations')
  const wrongMethod = await fetch(route)
  assert.equal(wrongMethod.status, 405)
  const crossOrigin = await fetch(route, {
    method: 'PUT', headers: { Origin: 'https://attacker.example', 'Content-Type': 'image/jpeg' },
    body: Buffer.from('fake image'),
  })
  assert.equal(crossOrigin.status, 403)
  console.log('PASS: Vite local S3 upload fallback installed; invalid destinations, methods, and origins rejected')
} finally {
  await vite.close()
}
