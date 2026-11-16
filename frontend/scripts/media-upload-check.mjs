import assert from 'node:assert/strict'
import { uploadPresignedFile } from '../src/features/chat/lib/mediaUpload.ts'
import { allowedChatNetUploadURL } from '../dev/chatMediaUploadProxy.ts'

class FakeXHR {
  static latest
  upload = {}
  headers = {}
  status = 0
  constructor() { FakeXHR.latest = this }
  open(method, url) { this.method = method; this.url = url }
  setRequestHeader(key, value) { this.headers[key] = value }
  send(file) { this.file = file }
  abort() { this.onabort?.() }
}
globalThis.XMLHttpRequest = FakeXHR
const file = { name: 'photo.png', size: 128 }
const signal = new AbortController()
const events = []
const first = uploadPresignedFile('https://s3.example/upload?a=1', file, 'image/png', signal.signal, (loaded) => events.push(loaded))
const uploaded = FakeXHR.latest
assert.equal(uploaded.method, 'PUT')
assert.equal(uploaded.url, 'https://s3.example/upload?a=1')
assert.equal(uploaded.headers['Content-Type'], 'image/png')
assert.equal(uploaded.withCredentials, false)
assert.equal(Object.keys(uploaded.headers).length, 1, 'No bearer-token header can reach S3')
uploaded.upload.onprogress({ lengthComputable: true, loaded: 64 })
uploaded.status = 200
uploaded.onload()
await first
assert.deepEqual(events, [64, 128])

const network = uploadPresignedFile('https://s3.example/upload', file, 'image/png', new AbortController().signal, () => {})
FakeXHR.latest.onerror()
await assert.rejects(network, /kết nối mạng/)

const http = uploadPresignedFile('https://s3.example/upload', file, 'image/png', new AbortController().signal, () => {})
FakeXHR.latest.status = 403
FakeXHR.latest.onload()
await assert.rejects(http, /HTTP 403/)

const timeout = uploadPresignedFile('https://s3.example/upload', file, 'image/png', new AbortController().signal, () => {})
FakeXHR.latest.ontimeout()
await assert.rejects(timeout, /quá thời gian/)

const cancel = new AbortController()
const abandoned = uploadPresignedFile('https://s3.example/upload', file, 'image/png', cancel.signal, () => {})
cancel.abort()
await assert.rejects(abandoned, (error) => error.name === 'AbortError')

const before = new AbortController()
before.abort()
await assert.rejects(
  uploadPresignedFile('https://s3.example/upload', file, 'image/png', before.signal, () => {}),
  (error) => error.name === 'AbortError',
)

const localRetry = uploadPresignedFile(
  'https://s3.example/upload', file, 'image/png', new AbortController().signal, () => {},
  { devFallbackUrl: '/__chatnet_s3_upload?url=signed' },
)
const directAttempt = FakeXHR.latest
directAttempt.onerror()
const viaLocalProxy = FakeXHR.latest
assert.notEqual(viaLocalProxy, directAttempt)
assert.equal(viaLocalProxy.url, '/__chatnet_s3_upload?url=signed')
assert.equal(viaLocalProxy.method, 'PUT')
assert.equal(viaLocalProxy.headers['Content-Type'], 'image/png')
assert.equal(Object.keys(viaLocalProxy.headers).length, 1)
viaLocalProxy.status = 204
viaLocalProxy.onload()
await localRetry

let relayCalls = 0
const apiRetry = uploadPresignedFile(
  'https://s3.example/upload', file, 'image/png', new AbortController().signal, () => {},
  { uploadThroughAPI: async () => { relayCalls += 1 } },
)
FakeXHR.latest.onerror()
await apiRetry
assert.equal(relayCalls, 1, 'The authenticated API relay is used after an S3 network error')

const rejected = uploadPresignedFile(
  'https://s3.example/upload', file, 'image/png', new AbortController().signal, () => {},
  { devFallbackUrl: '/__chatnet_s3_upload?url=signed' },
)
FakeXHR.latest.status = 403
FakeXHR.latest.onload()
await assert.rejects(rejected, /HTTP 403/, 'An explicit S3 rejection must not be hidden by a retry')

const signedURL = 'https://s3-hcm-r2.s3cloud.vn/media/chatnet/chat/15/2026/11/' +
  '0123456789abcdef0123456789abcdef.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-SignedHeaders=host&X-Amz-Signature=' +
  '0'.repeat(64)
assert.equal(allowedChatNetUploadURL(signedURL), true)
assert.equal(allowedChatNetUploadURL(signedURL.replace('s3-hcm-r2.s3cloud.vn', 'attacker.test')), false)
assert.equal(allowedChatNetUploadURL(signedURL.replace('https:', 'http:')), false)
assert.equal(allowedChatNetUploadURL(signedURL.replace('/chatnet/chat/15/', '/other/chat/15/')), false)
assert.equal(allowedChatNetUploadURL('https://127.0.0.1/upload'), false)

console.log('PASS: S3 direct upload, safe local retry, authenticated relay, network/HTTP errors, timeout, abort, URL restrictions')
