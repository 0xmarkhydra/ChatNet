// Experimental cryptographic smoke test with a real RFC 9420 implementation.
// No application secrets, server requests, or persisted keys involved.
import assert from 'node:assert/strict'
import {
  acceptAll, createApplicationMessage, createCommit, createGroup, decodeMlsMessage,
  defaultCapabilities, defaultLifetime, emptyPskIndex, encodeMlsMessage,
  generateKeyPackage, getCiphersuiteFromName, getCiphersuiteImpl, joinGroup,
  processMessage, processPrivateMessage, zeroOutUint8Array,
} from 'ts-mls'

const encode = new TextEncoder()
const decode = new TextDecoder()
const cipher = await getCiphersuiteImpl(
  getCiphersuiteFromName('MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'),
)
const makeDevice = name => generateKeyPackage(
  { credentialType: 'basic', identity: encode.encode(name) },
  defaultCapabilities(), defaultLifetime, [], cipher,
)
const alice = await makeDevice('alice:device-1')
const bob = await makeDevice('bob:device-1')
const groupId = encode.encode('chatnet:mls:poc:conversation-1')
let aliceState = await createGroup(groupId, alice.publicPackage, alice.privatePackage, [], cipher)

const bobPackageBytes = encodeMlsMessage({
  keyPackage: bob.publicPackage, wireformat: 'mls_key_package', version: 'mls10',
})
const [receivedBobPackage, consumedPackageBytes] = decodeMlsMessage(bobPackageBytes, 0)
assert.equal(consumedPackageBytes, bobPackageBytes.length)
assert.equal(receivedBobPackage.wireformat, 'mls_key_package')

const addBob = await createCommit({ state: aliceState, cipherSuite: cipher }, {
  extraProposals: [{ proposalType: 'add', add: { keyPackage: receivedBobPackage.keyPackage } }],
  ratchetTreeExtension: true,
})
aliceState = addBob.newState
addBob.consumed.forEach(zeroOutUint8Array)
const firstCommit = encodeMlsMessage(addBob.commit)
assert.ok(firstCommit.byteLength > 32)
const welcomeBytes = encodeMlsMessage({
  welcome: addBob.welcome, wireformat: 'mls_welcome', version: 'mls10',
})
const [receivedWelcome, consumedWelcomeBytes] = decodeMlsMessage(welcomeBytes, 0)
assert.equal(consumedWelcomeBytes, welcomeBytes.length)
assert.equal(receivedWelcome.wireformat, 'mls_welcome')
let bobState = await joinGroup(
  receivedWelcome.welcome, bob.publicPackage, bob.privatePackage,
  emptyPskIndex, cipher,
)
assert.equal(bobState.groupContext.epoch, aliceState.groupContext.epoch)

const plaintext = encode.encode('Xin chào Bob 👋 - đây là tin nhắn thực sự được mã hóa MLS.')
const generated = await createApplicationMessage(aliceState, plaintext, cipher)
aliceState = generated.newState
generated.consumed.forEach(zeroOutUint8Array)
const encryptedMessage = encodeMlsMessage({
  privateMessage: generated.privateMessage, wireformat: 'mls_private_message', version: 'mls10',
})
assert.equal(Buffer.from(encryptedMessage).includes(Buffer.from(plaintext)), false)
const [receivedCiphertext, receivedLength] = decodeMlsMessage(encryptedMessage, 0)
assert.equal(receivedLength, encryptedMessage.length)
assert.equal(receivedCiphertext.wireformat, 'mls_private_message')
const decrypted = await processPrivateMessage(
  bobState, receivedCiphertext.privateMessage, emptyPskIndex, cipher,
)
if (decrypted.kind !== 'applicationMessage') throw new Error('Expected MLS application')
bobState = decrypted.newState
decrypted.consumed.forEach(zeroOutUint8Array)
assert.equal(decode.decode(decrypted.message), decode.decode(plaintext))

const removedBob = await createCommit({ state: aliceState, cipherSuite: cipher }, {
  extraProposals: [{ proposalType: 'remove', remove: { removed: 1 } }],
})
aliceState = removedBob.newState
removedBob.consumed.forEach(zeroOutUint8Array)
const removalWire = encodeMlsMessage(removedBob.commit)
const [removalMessage] = decodeMlsMessage(removalWire, 0)
const removalResult = await processMessage(removalMessage, bobState, emptyPskIndex, acceptAll, cipher)
bobState = removalResult.newState
removalResult.consumed.forEach(zeroOutUint8Array)
assert.equal(bobState.groupActiveState.kind, 'removedFromGroup')
const afterRemoval = await createApplicationMessage(
  aliceState, encode.encode('This must not reach Bob after removal'), cipher,
)
aliceState = afterRemoval.newState
afterRemoval.consumed.forEach(zeroOutUint8Array)
const afterWire = encodeMlsMessage({
  privateMessage: afterRemoval.privateMessage, wireformat: 'mls_private_message', version: 'mls10',
})
const [afterMessage] = decodeMlsMessage(afterWire, 0)
await assert.rejects(
  () => processPrivateMessage(bobState, afterMessage.privateMessage, emptyPskIndex, cipher),
  'Removed MLS member must not decrypt messages in new epoch',
)
console.log('PASS actual MLS 1.0 create/join, Welcome, encrypted message, and post-removal confidentiality')
