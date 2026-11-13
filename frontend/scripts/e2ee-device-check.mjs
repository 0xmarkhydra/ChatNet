import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { generateE2EEDeviceIdentity, signE2EEDeviceRegistration, signE2EEKeyPackage, signE2EEDeviceRevocation, verifyClaimedE2EEKeyPackage } from '../src/features/auth/lib/e2eeIdentity.ts'

const crypto = webcrypto
globalThis.crypto ??= crypto

const device = await generateE2EEDeviceIdentity()
assert.equal(device.privateKey.extractable, false)
const challenge = {
  challenge: Buffer.alloc(32, 7).toString('base64url'),
  sessionId: '38f73c18-eb58-4ea6-887e-199bef34571a',
  expiresInSeconds: 120,
}
const userId = 42
const registered = await signE2EEDeviceRegistration(device, userId, challenge, 'Mac')
assert.match(registered.deviceId, /^[0-9a-f-]{36}$/)
assert.equal(registered.identityKey, device.publicKey)

const publicKey = await crypto.subtle.importKey(
  'raw', Buffer.from(registered.identityKey, 'base64url'), 'Ed25519', false, ['verify'],
)
const verify = async (uid, sid, id) => {
  const message = [
    'chatnet:e2ee:register:v1', String(uid), sid, id,
    registered.identityKey, registered.challenge, registered.label,
  ].join('\n')
  return crypto.subtle.verify('Ed25519', publicKey, Buffer.from(registered.signature, 'base64url'),
    new TextEncoder().encode(message))
}
assert.equal(await verify(userId, challenge.sessionId, registered.deviceId), true)
assert.equal(await verify(userId + 1, challenge.sessionId, registered.deviceId), false)
assert.equal(await verify(userId, challenge.sessionId, crypto.randomUUID()), false)
assert.equal(await verify(userId, crypto.randomUUID(), registered.deviceId), false)

await assert.rejects(() => crypto.subtle.exportKey('pkcs8', device.privateKey))
await assert.rejects(() => signE2EEDeviceRegistration(device, userId, {
  ...challenge, challenge: 'invalid',
}, 'Mac'))
const packageBytes = crypto.getRandomValues(new Uint8Array(256))
const published = await signE2EEKeyPackage(device, userId, registered.deviceId, challenge, packageBytes)
assert.match(published.packageId, /^[0-9a-f-]{36}$/)
assert.deepEqual(Buffer.from(published.package, 'base64url'), Buffer.from(packageBytes))
const digest = Buffer.from(await crypto.subtle.digest('SHA-256', packageBytes)).toString('base64url')
const verifyPackage = async (uid, sid, id, hash) => {
  const message = [
    'chatnet:e2ee:keypackage:publish:v1', String(uid), sid, registered.deviceId,
    id, hash, published.challenge,
  ].join('\n')
  return crypto.subtle.verify('Ed25519', publicKey,
    Buffer.from(published.signature, 'base64url'), new TextEncoder().encode(message))
}
assert.equal(await verifyPackage(userId, challenge.sessionId, published.packageId, digest), true)
assert.equal(await verifyPackage(userId + 1, challenge.sessionId, published.packageId, digest), false)
assert.equal(await verifyPackage(userId, crypto.randomUUID(), published.packageId, digest), false)
assert.equal(await verifyPackage(userId, challenge.sessionId, crypto.randomUUID(), digest), false)
assert.equal(await verifyPackage(userId, challenge.sessionId, published.packageId, Buffer.alloc(32).toString('base64url')), false)
await assert.rejects(() => signE2EEKeyPackage(device, userId, registered.deviceId, challenge, new Uint8Array(4)))
const revoked = await signE2EEDeviceRevocation(
  device, userId, registered.deviceId, crypto.randomUUID(), challenge,
)
const signedTarget = crypto.randomUUID()
const actualRevocation = await signE2EEDeviceRevocation(
  device, userId, registered.deviceId, signedTarget, challenge,
)
const verifyRevocation = async (uid, target) => {
  const message = [
    'chatnet:e2ee:device:revoke:v1', String(uid), challenge.sessionId,
    target, actualRevocation.authorizingDeviceId, actualRevocation.challenge,
  ].join('\n')
  return crypto.subtle.verify('Ed25519', publicKey,
    Buffer.from(actualRevocation.signature, 'base64url'), new TextEncoder().encode(message))
}
assert.equal(revoked.authorizingDeviceId, registered.deviceId)
assert.equal(await verifyRevocation(userId, signedTarget), true)
assert.equal(await verifyRevocation(userId + 1, signedTarget), false)
assert.equal(await verifyRevocation(userId, crypto.randomUUID()), false)
const attested = {
  userId, deviceId: published.deviceId, packageId: published.packageId,
  package: published.package, challenge: published.challenge,
  signature: published.signature, sessionId: challenge.sessionId,
}
const peerExpectation = {
  userId, deviceId: registered.deviceId, verifiedIdentityPublicKey: device.publicKey,
}
assert.deepEqual(
  Buffer.from(await verifyClaimedE2EEKeyPackage(attested, peerExpectation)),
  Buffer.from(packageBytes),
)
await assert.rejects(() => verifyClaimedE2EEKeyPackage(
  { ...attested, sessionId: crypto.randomUUID() }, peerExpectation,
))
await assert.rejects(() => verifyClaimedE2EEKeyPackage(
  { ...attested, packageId: crypto.randomUUID() }, peerExpectation,
))
await assert.rejects(() => verifyClaimedE2EEKeyPackage(
  { ...attested, package: Buffer.alloc(256, 6).toString('base64url') }, peerExpectation,
))
await assert.rejects(() => verifyClaimedE2EEKeyPackage(
  { ...attested, signature: Buffer.alloc(64).toString('base64url') }, peerExpectation,
))
await assert.rejects(() => verifyClaimedE2EEKeyPackage(
  attested, { ...peerExpectation, verifiedIdentityPublicKey: Buffer.alloc(32).toString('base64url') },
))
await assert.rejects(() => verifyClaimedE2EEKeyPackage(
  attested, { ...peerExpectation, userId: userId + 1 },
))
console.log('PASS E2EE signed KeyPackage attestation against pinned device identity + tamper rejection')
