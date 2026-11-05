import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { allowedChatCopyImageURL, chatCopyImageDevProxy } from '../dev/chatCopyImageProxy.ts'

const signature = 'a'.repeat(64)
const signedImage = 'https://s3-hcm-r2.s3cloud.vn/socco/chatnet/chat/2/2026/11/0123456789abcdef0123456789abcdef.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=' + signature
const rawImage = 'https://s3-hcm-r2.s3cloud.vn/chatnet/chat/2/2026/11/0123456789abcdef0123456789abcdef.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=' + signature
assert.ok(allowedChatCopyImageURL(signedImage))
assert.ok(allowedChatCopyImageURL(rawImage))
for (const url of [
  'http://s3-hcm-r2.s3cloud.vn/chatnet/chat/2/test.png',
  signedImage.replace('s3-hcm-r2.s3cloud.vn', '127.0.0.1'),
  signedImage.replace('s3-hcm-r2.s3cloud.vn', 'evil.example'),
  signedImage.replace('/chatnet/chat/', '/chatnet/feed/'),
  signedImage.replace('X-Amz-Algorithm=AWS4-HMAC-SHA256', 'X-Amz-Algorithm=NONE'),
  signedImage.replace('X-Amz-Signature=' + signature, ''),
  'https://evil.example/?redirect=' + encodeURIComponent(signedImage),
]) {
  assert.equal(allowedChatCopyImageURL(url), false, 'must reject unsafe request: ' + url.slice(0, 100))
}

let middleware
const plugin = chatCopyImageDevProxy()
plugin.configureServer({ middlewares: { use: (path, callback) => {
  assert.equal(path, '/__chatnet_copy_image')
  middleware = callback
} } })
assert.ok(middleware, 'Vite plugin must install a middleware')
const server = createServer((req, res) => middleware(req, res))
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const port = server.address().port
const originalFetch = globalThis.fetch
let remoteFetchCount = 0
try {
  const proxyURL = 'http://127.0.0.1:' + port + '/__chatnet_copy_image?url=' + encodeURIComponent(signedImage)
  globalThis.fetch = async (url, opts) => {
    if (url.toString() === signedImage) {
      remoteFetchCount++
      assert.equal(opts.redirect, 'manual', 'never follow off-host redirects')
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { 'Content-Type': 'image/png', 'Content-Length': '4' },
      })
    }
    return originalFetch(url, opts)
  }
  const ok = await originalFetch(proxyURL)
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('content-type'), 'image/png')
  assert.equal(ok.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(new Uint8Array(await ok.arrayBuffer()), new Uint8Array([137, 80, 78, 71]))
  assert.equal(remoteFetchCount, 1)

  const denied = await originalFetch('http://127.0.0.1:' + port + '/__chatnet_copy_image?url=' +
    encodeURIComponent('http://127.0.0.1:8080/private'))
  assert.equal(denied.status, 403)
  assert.equal(remoteFetchCount, 1, 'reject SSRF before any upstream fetch')
} finally {
  globalThis.fetch = originalFetch
  server.close()
  await once(server, 'close')
}

console.log('PASS: restricted presigned-chat-image proxy, browser-compatible image response, no-cache and SSRF rejection')
