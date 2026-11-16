import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { decodeMLSPayload, signMLSTransportEvent } from '../src/features/chat/lib/mlsTransport.ts'

globalThis.crypto ??= webcrypto
const identity = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify'])
const userId = 143
const conversationId = 901
const deviceId = crypto.randomUUID()
const targetDeviceId = crypto.randomUUID()
const payload = new Uint8Array(131072)
for (let i = 0; i < payload.length; i += 16384) crypto.getRandomValues(payload.subarray(i, i + 16384))
const signed = await signMLSTransportEvent({
  userId, conversationId, deviceId, privateKey: identity.privateKey,
  eventType: 'welcome', epoch: 7, targetDeviceId, mlsWireMessage: payload,
})
assert.deepEqual(decodeMLSPayload(signed.payload), payload)
assert.equal(signed.targetDeviceId, targetDeviceId)
assert.match(signed.clientId, /^[0-9a-f-]{36}$/)

const digest = Buffer.from(await crypto.subtle.digest('SHA-256', payload)).toString('base64url')
const verify = async (u, group, epoch, target, hash) => {
  const transcript = [
    'chatnet:e2ee:mls:relay:v1', String(u), String(group), deviceId,
    signed.clientId, 'welcome', String(epoch), target, hash,
  ].join('\n')
  return crypto.subtle.verify(
    'Ed25519', identity.publicKey, Buffer.from(signed.signature, 'base64url'),
    new TextEncoder().encode(transcript),
  )
}
assert.equal(await verify(userId, conversationId, 7, targetDeviceId, digest), true)
assert.equal(await verify(userId + 1, conversationId, 7, targetDeviceId, digest), false)
assert.equal(await verify(userId, conversationId + 1, 7, targetDeviceId, digest), false)
assert.equal(await verify(userId, conversationId, 8, targetDeviceId, digest), false)
assert.equal(await verify(userId, conversationId, 7, crypto.randomUUID(), digest), false)
assert.equal(await verify(userId, conversationId, 7, targetDeviceId,
  Buffer.alloc(32).toString('base64url')), false)
await assert.rejects(() => signMLSTransportEvent({
  userId, conversationId, deviceId, privateKey: identity.privateKey,
  eventType: 'application', epoch: 1, targetDeviceId, mlsWireMessage: payload,
}))
assert.throws(() => decodeMLSPayload('not base64!'))
assert.throws(() => decodeMLSPayload('YQ'))
console.log('PASS MLS opaque transport signing, 128KiB payload and integrity bindings')
