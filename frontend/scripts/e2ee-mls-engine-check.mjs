import assert from 'node:assert/strict'
import { generateE2EEDeviceIdentity, signE2EEKeyPackage } from '../src/features/auth/lib/e2eeIdentity.ts'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
const vite = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  configFile: false, logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
})
try {
const {
  addExperimentalMLSDevice, createExperimentalMLSCiphersuite,
  createExperimentalMLSDevice, createExperimentalMLSGroup,
  encryptExperimentalMLSMessage, ExperimentalMLSTrust,
  joinExperimentalMLSGroup, receiveExperimentalMLSMessage,
  verifyExperimentalMLSPackage, trustAttestedExperimentalMLSPeer,
} = await vite.ssrLoadModule('/src/features/chat/lib/mlsEngineExperimental.ts')

const suite = await createExperimentalMLSCiphersuite()
const alice = await createExperimentalMLSDevice(201, crypto.randomUUID(), suite)
const bob = await createExperimentalMLSDevice(202, crypto.randomUUID(), suite)
const outsider = await createExperimentalMLSDevice(203, crypto.randomUUID(), suite)

const trustAlice = new ExperimentalMLSTrust()
const trustBob = new ExperimentalMLSTrust()
trustAlice.authorize(alice.userId, alice.deviceId, alice.publicPackage.leafNode.signaturePublicKey)
trustBob.authorize(bob.userId, bob.deviceId, bob.publicPackage.leafNode.signaturePublicKey)
const aliceProofKey = await generateE2EEDeviceIdentity()
const bobProofKey = await generateE2EEDeviceIdentity()
const sessionChallenge = {
  challenge: Buffer.alloc(32, 23).toString('base64url'),
  sessionId: crypto.randomUUID(), expiresInSeconds: 120,
}
const signClaim = async (device, identity) => {
  const signed = await signE2EEKeyPackage(
    identity, device.userId, device.deviceId, sessionChallenge, device.keyPackageBytes,
  )
  return { ...signed, userId: device.userId, sessionId: sessionChallenge.sessionId }
}
const aliceClaim = await signClaim(alice, aliceProofKey)
const bobClaim = await signClaim(bob, bobProofKey)
// Keys in the fixture are "pinned" out of band from the local test peer.
// The real app must never silently trust a key freshly supplied by the server.
await trustAttestedExperimentalMLSPeer(bobClaim, {
  userId: bob.userId, deviceId: bob.deviceId,
  pinnedDeviceIdentityPublicKey: bobProofKey.publicKey,
}, suite, trustAlice)
await trustAttestedExperimentalMLSPeer(aliceClaim, {
  userId: alice.userId, deviceId: alice.deviceId,
  pinnedDeviceIdentityPublicKey: aliceProofKey.publicKey,
}, suite, trustBob)
await assert.rejects(() => trustAttestedExperimentalMLSPeer(
  { ...bobClaim, package: aliceClaim.package },
  { userId: bob.userId, deviceId: bob.deviceId,
    pinnedDeviceIdentityPublicKey: bobProofKey.publicKey },
  suite, trustAlice,
))

await assert.rejects(
  () => verifyExperimentalMLSPackage(outsider.keyPackageBytes, bob.userId, bob.deviceId, suite, trustAlice),
)
const tamperedPackage = new Uint8Array(bob.keyPackageBytes)
tamperedPackage[tamperedPackage.length - 1] ^= 1
await assert.rejects(() => verifyExperimentalMLSPackage(
  tamperedPackage, bob.userId, bob.deviceId, suite, trustAlice,
))
assert.throws(() => trustAlice.authorize(bob.userId, bob.deviceId, outsider.publicPackage.leafNode.signaturePublicKey))

const conversationId = 555
let aliceSession = await createExperimentalMLSGroup(conversationId, alice, suite, trustAlice)
const added = await addExperimentalMLSDevice(
  aliceSession, bob.keyPackageBytes, bob.userId, bob.deviceId, trustAlice,
)
aliceSession = added.next
assert.equal(added.epoch, 1)
assert.ok(added.commit.length > 32)
assert.ok(added.welcome.length > 32)
await assert.rejects(() => joinExperimentalMLSGroup(
  conversationId + 1, bob, added.welcome, suite, trustBob,
))
let bobSession = await joinExperimentalMLSGroup(conversationId, bob, added.welcome, suite, trustBob)
const text = 'Xin chào từ client A, chỉ client được cấp khóa MLS mới đọc được! 🔐'
const sent = await encryptExperimentalMLSMessage(aliceSession, new TextEncoder().encode(text))
aliceSession = sent.next
assert.equal(sent.epoch, 1)
assert.equal(Buffer.from(sent.ciphertext).includes(Buffer.from(text)), false)
const decrypted = await receiveExperimentalMLSMessage(bobSession, sent.ciphertext)
bobSession = decrypted.next
assert.equal(new TextDecoder().decode(decrypted.plaintext), text)
const tamperedCiphertext = new Uint8Array(sent.ciphertext)
tamperedCiphertext[tamperedCiphertext.length - 2] ^= 1
await assert.rejects(() => receiveExperimentalMLSMessage(bobSession, tamperedCiphertext))
await assert.rejects(() => receiveExperimentalMLSMessage(bobSession, sent.ciphertext))
await assert.rejects(() => encryptExperimentalMLSMessage(aliceSession, new Uint8Array()))
console.log('PASS ChatNet real MLS client engine: pinned device proof, Welcome, encrypted text, tamper/replay rejection')
} finally {
  await vite.close()
}
