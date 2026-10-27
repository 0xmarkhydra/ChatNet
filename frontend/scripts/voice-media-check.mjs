import assert from 'node:assert/strict'
import { preferredVoiceMime, voiceFileType } from '../src/features/chat/voiceMedia.ts'

assert.equal(preferredVoiceMime((mime) => mime.startsWith('audio/webm')), 'audio/webm;codecs=opus', 'Chromium Opus preferred')
assert.equal(preferredVoiceMime((mime) => mime === 'audio/mp4'), 'audio/mp4', 'Safari uses MP4')
assert.equal(preferredVoiceMime(() => false), '', 'Browser default fallback')
assert.deepEqual(voiceFileType('audio/webm;codecs=opus'), { contentType: 'audio/webm', extension: 'webm' })
assert.deepEqual(voiceFileType('audio/mp4'), { contentType: 'audio/mp4', extension: 'm4a' })
assert.deepEqual(voiceFileType('audio/ogg;codecs=opus'), { contentType: 'audio/ogg', extension: 'ogg' })
assert.equal(voiceFileType('video/webm'), null, 'Video must never be mislabelled voice')
assert.equal(voiceFileType('image/svg+xml'), null, 'Active content must never be accepted')
assert.equal(voiceFileType(''), null)
console.log('PASS: Chrome/Safari voice MIME negotiation and safe upload file extension')
