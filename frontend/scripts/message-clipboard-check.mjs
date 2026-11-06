import assert from 'node:assert/strict'
import { copyableMessageLinks, messageTextParts, copyChatImage } from '../src/features/chat/messageClipboard.ts'

const raw = 'Xem https://example.com/a?b=1, rồi https://docs.example.org/readme. '
assert.deepEqual(copyableMessageLinks(raw), ['https://example.com/a?b=1', 'https://docs.example.org/readme'])
assert.equal(messageTextParts(raw).map((part) => part.text).join(''), raw)
assert.deepEqual(copyableMessageLinks('https://site.test/a https://site.test/a'), ['https://site.test/a'])
assert.deepEqual(copyableMessageLinks('javascript:alert(1) và văn bản bình thường'), [])
assert.deepEqual(copyableMessageLinks('www.example.com và example.vn'), ['www.example.com', 'example.vn'])
assert.deepEqual(copyableMessageLinks('Gửi tới support@example.com'), [])
assert.deepEqual(messageTextParts('không có link'), [{ kind: 'text', text: 'không có link' }])

const events = []
const clipboardItems = []
Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { href: 'https://chat.example/' } } })
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  clipboard: { write: async (items) => {
    events.push('write')
    clipboardItems.push(...items)
    await items[0].data['image/png']
  } },
} })
class MockClipboardItem {
  constructor(data) { events.push('item'); this.data = data }
}
globalThis.ClipboardItem = MockClipboardItem

let fetchedURL = ''
let fetchOptions
globalThis.fetch = async (url, options) => {
  events.push('fetch')
  fetchedURL = url
  fetchOptions = options
  return { ok: true, blob: async () => new Blob([new Uint8Array([137,80,78,71])], { type: 'image/png' }) }
}
await copyChatImage('https://cdn.example/media.png?signature=abc')
assert.equal(fetchedURL, 'https://cdn.example/media.png?signature=abc')
assert.equal(fetchOptions.credentials, 'omit')
assert.equal(fetchOptions.mode, 'cors')
assert.deepEqual(events, ['fetch', 'item', 'write'], 'write() must start synchronously for Safari gesture authorization')
assert.equal((await clipboardItems[0].data['image/png']).type, 'image/png')

const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({ drawImage: () => events.push('draw') }),
  toBlob: (cb) => cb(new Blob(['converted'], { type: 'image/png' })),
}
globalThis.document = { createElement: () => canvas }
globalThis.createImageBitmap = async () => ({
  width: 2, height: 3, close: () => events.push('closed'),
})
globalThis.fetch = async () => ({ ok: true, blob: async () => new Blob(['jpeg'], { type: 'image/jpeg' }) })
await copyChatImage('https://cdn.example/media.jpg')
assert.equal(canvas.width, 2)
assert.equal(canvas.height, 3)
assert.ok(events.includes('draw'))
assert.ok(events.includes('closed'))
assert.equal((await clipboardItems.at(-1).data['image/png']).type, 'image/png')

const fallbackSource = 'https://s3-hcm-r2.s3cloud.vn/bucket/chatnet/chat/2/2026/11/0123456789abcdef0123456789abcdef.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=' + 'a'.repeat(64)
let fallbackCalls = 0
globalThis.fetch = async (url, options) => {
  fallbackCalls++
  if (fallbackCalls === 1) {
    assert.equal(url, fallbackSource)
    throw new TypeError('Failed to fetch: CORS')
  }
  const fallback = new URL(url)
  assert.equal(fallback.pathname, '/__chatnet_copy_image')
  assert.equal(fallback.searchParams.get('url'), fallbackSource)
  assert.equal(options.credentials, 'same-origin')
  return { ok: true, blob: async () => new Blob([new Uint8Array([137,80,78,71])], { type: 'image/png' }) }
}
await copyChatImage(fallbackSource)
assert.equal(fallbackCalls, 2, 'S3 CORS error must retry once via same-origin image proxy')
assert.equal((await clipboardItems.at(-1).data['image/png']).type, 'image/png')

globalThis.fetch = async () => ({ ok: false, status: 403 })
await assert.rejects(copyChatImage('https://cdn.example/expired.png'), /Liên kết ảnh đã hết hạn/)
await assert.rejects(copyChatImage('data:text/html,hello'), /Địa chỉ ảnh không hợp lệ/)

console.log('PASS: copy text/link, PNG/JPEG clipboard, S3 CORS same-origin fallback, secure clipboard write, denied/unsafe images')
