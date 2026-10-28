import assert from 'node:assert/strict'
import {
  createCallTranscript,
  decryptCallTranscript,
  encryptCallTranscript,
} from '../src/features/calls/callTranslation.ts'

const key = crypto.getRandomValues(new Uint8Array(32))
const transcript = createCallTranscript('  Xin   chào cả nhóm  ', 'vi-VN')
assert.ok(transcript)
assert.equal(transcript.text, 'Xin chào cả nhóm')
assert.equal(transcript.sourceLanguage, 'vi')

const encrypted = await encryptCallTranscript(transcript, key, 'call_test')
assert.equal(new TextDecoder().decode(encrypted).includes(transcript.text), false, 'payload must not expose speech')
assert.deepEqual(await decryptCallTranscript(encrypted, key, 'call_test'), transcript)
assert.equal(await decryptCallTranscript(encrypted, key, 'another_call'), null, 'payload must bind to its call')

const tampered = encrypted.slice()
tampered[tampered.length - 2] ^= 1
assert.equal(await decryptCallTranscript(tampered, key, 'call_test'), null, 'tampered payload must fail closed')
assert.equal(createCallTranscript('', 'vi'), null)
assert.equal(createCallTranscript('hello', '../en'), null)

console.log('PASS: realtime call transcripts are normalized, authenticated and encrypted per call')
