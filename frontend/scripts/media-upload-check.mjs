import assert from 'node:assert/strict'
import { uploadPresignedFile } from '../src/features/chat/mediaUpload.ts'

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

console.log('PASS: S3 upload progress, success, HTTP/network errors, timeout, abort, no bearer token')
