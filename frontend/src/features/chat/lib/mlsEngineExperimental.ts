// EXPERIMENTAL, NOT PRODUCTION-READY: actual MLS 1.0 cryptography using
// ts-mls@1.6.4. This dependency has not received an independent audit.
// Never wire to the live composer until device-key attestation, MLS state
// persistence, membership commits, migration and recovery have passed review.
import {
  acceptAll, createApplicationMessage, createCommit, createGroup, decodeMlsMessage,
  defaultCapabilities, defaultLifetime, emptyPskIndex, encodeMlsMessage,
  generateKeyPackage, getCiphersuiteFromName, getCiphersuiteImpl, joinGroup,
  processMessage, processPrivateMessage, zeroOutUint8Array,
  type ClientState, type CiphersuiteImpl, type PrivateKeyPackage, type KeyPackage,
} from 'ts-mls'
import { defaultClientConfig } from 'ts-mls/clientConfig.js'
import { verifyClaimedE2EEKeyPackage, type ClaimedE2EEKeyPackage } from '../../auth'
import { verifyKeyPackage } from 'ts-mls/keyPackage.js'

const CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
const MAX_MESSAGE_BYTES = 96 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const utf8 = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export type ExperimentalMLSDevice = {
  userId: number
  deviceId: string
  keyPackageBytes: Uint8Array
  // Private key material is intentionally ephemeral in this PoC.
  privatePackage: PrivateKeyPackage
  publicPackage: KeyPackage
}

export type ExperimentalMLSSession = {
  state: ClientState
  suite: CiphersuiteImpl
}

function ensureIdentity(userId: number, deviceId: string): void {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !UUID.test(deviceId)) {
    throw new Error('Invalid MLS user/device identity')
  }
}

function memberKey(userId: number, deviceId: string): string {
  ensureIdentity(userId, deviceId)
  return `chatnet:mls:device:v1:${userId}:${deviceId}`
}

function b64(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i]
  return difference === 0
}

function decodeFull(bytes: Uint8Array) {
  if (bytes.byteLength < 32 || bytes.byteLength > 131072) {
    throw new Error('Invalid MLS wire message length')
  }
  const decoded = decodeMlsMessage(bytes, 0)
  if (!decoded || decoded[1] !== bytes.byteLength || decoded[0].version !== 'mls10') {
    throw new Error('Invalid/trailing MLS wire data')
  }
  return decoded[0]
}

export async function createExperimentalMLSCiphersuite(): Promise<CiphersuiteImpl> {
  return getCiphersuiteImpl(getCiphersuiteFromName(CIPHERSUITE))
}

// The caller must independently verify a user's account/device identity and
// its MLS KeyPackage binding before calling authorize(). The directory alone
// is NOT sufficient protection against a compromised server.
export class ExperimentalMLSTrust {
  private readonly known = new Map<string, string>()

  authorize(userId: number, deviceId: string, verifiedSignaturePublicKey: Uint8Array): void {
    const key = memberKey(userId, deviceId)
    if (verifiedSignaturePublicKey.length !== 32) {
      throw new Error('Invalid verified MLS Ed25519 public key')
    }
    const encoded = b64(verifiedSignaturePublicKey)
    if (this.known.has(key) && this.known.get(key) !== encoded) {
      throw new Error('MLS identity changed; require out-of-band verification')
    }
    this.known.set(key, encoded)
  }

  readonly config = {
    ...defaultClientConfig,
    authService: {
      validateCredential: async (credential: { credentialType: string; identity?: Uint8Array },
        signaturePublicKey: Uint8Array): Promise<boolean> => {
        if (credential.credentialType !== 'basic' || !credential.identity) return false
        let identity: string
        try {
          identity = decoder.decode(credential.identity)
        } catch {
          return false
        }
        return this.known.get(identity) === b64(signaturePublicKey)
      },
    },
  }

  require(userId: number, deviceId: string, signaturePublicKey: Uint8Array): void {
    if (this.known.get(memberKey(userId, deviceId)) !== b64(signaturePublicKey)) {
      throw new Error('Unknown or changed MLS credential')
    }
  }
}

export async function createExperimentalMLSDevice(
  userId: number,
  deviceId: string,
  suite: CiphersuiteImpl,
): Promise<ExperimentalMLSDevice> {
  ensureIdentity(userId, deviceId)
  if (suite.name !== CIPHERSUITE) throw new Error('Unsupported MLS ciphersuite')
  const generated = await generateKeyPackage(
    { credentialType: 'basic', identity: utf8.encode(memberKey(userId, deviceId)) },
    defaultCapabilities(), defaultLifetime, [], suite,
  )
  const keyPackageBytes = encodeMlsMessage({
    wireformat: 'mls_key_package', version: 'mls10', keyPackage: generated.publicPackage,
  })
  return {
    userId, deviceId, keyPackageBytes,
    publicPackage: generated.publicPackage, privatePackage: generated.privatePackage,
  }
}

function conversationGroupID(conversationId: number): Uint8Array {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
    throw new Error('Invalid conversation ID')
  }
  return utf8.encode(`chatnet:mls:conversation:v1:${conversationId}`)
}

export async function createExperimentalMLSGroup(
  conversationId: number,
  creator: ExperimentalMLSDevice,
  suite: CiphersuiteImpl,
  trust: ExperimentalMLSTrust,
): Promise<ExperimentalMLSSession> {
  trust.require(creator.userId, creator.deviceId, creator.publicPackage.leafNode.signaturePublicKey)
  const state = await createGroup(
    conversationGroupID(conversationId), creator.publicPackage, creator.privatePackage,
    [], suite, trust.config,
  )
  return { state, suite }
}

// Bind the MLS leaf signature key to an independently verified device identity.
 // The server-delivered KeyPackage alone must never become a trusted identity.
export async function trustAttestedExperimentalMLSPeer(
  claimed: ClaimedE2EEKeyPackage,
  expected: { userId: number; deviceId: string; pinnedDeviceIdentityPublicKey: string },
  suite: CiphersuiteImpl,
  trust: ExperimentalMLSTrust,
): Promise<Uint8Array> {
  const bytes = await verifyClaimedE2EEKeyPackage(claimed, {
    userId: expected.userId,
    deviceId: expected.deviceId,
    verifiedIdentityPublicKey: expected.pinnedDeviceIdentityPublicKey,
  })
  const wire = decodeFull(bytes)
  if (wire.wireformat !== 'mls_key_package' ||
      wire.keyPackage.cipherSuite !== suite.name ||
      wire.keyPackage.leafNode.credential.credentialType !== 'basic' ||
      decoder.decode(wire.keyPackage.leafNode.credential.identity) !==
        memberKey(expected.userId, expected.deviceId) ||
      !await verifyKeyPackage(wire.keyPackage, suite.signature)) {
    throw new Error('Attested device advertised an invalid MLS KeyPackage')
  }
  trust.authorize(expected.userId, expected.deviceId,
    wire.keyPackage.leafNode.signaturePublicKey)
  return bytes
}

export async function verifyExperimentalMLSPackage(
  bytes: Uint8Array,
  expectedUserId: number,
  expectedDeviceId: string,
  suite: CiphersuiteImpl,
  trust: ExperimentalMLSTrust,
): Promise<KeyPackage> {
  const wire = decodeFull(bytes)
  if (wire.wireformat !== 'mls_key_package' ||
      wire.keyPackage.cipherSuite !== suite.name ||
      wire.keyPackage.leafNode.credential.credentialType !== 'basic' ||
      decoder.decode(wire.keyPackage.leafNode.credential.identity) !==
        memberKey(expectedUserId, expectedDeviceId) ||
      !await verifyKeyPackage(wire.keyPackage, suite.signature)) {
    throw new Error('Invalid MLS KeyPackage or identity')
  }
  trust.require(
    expectedUserId, expectedDeviceId, wire.keyPackage.leafNode.signaturePublicKey,
  )
  return wire.keyPackage
}

export async function addExperimentalMLSDevice(
  session: ExperimentalMLSSession,
  keyPackageBytes: Uint8Array,
  peerUserId: number,
  peerDeviceId: string,
  trust: ExperimentalMLSTrust,
): Promise<{ next: ExperimentalMLSSession; commit: Uint8Array; welcome: Uint8Array; epoch: number }> {
  const keyPackage = await verifyExperimentalMLSPackage(
    keyPackageBytes, peerUserId, peerDeviceId, session.suite, trust,
  )
  const result = await createCommit({ state: session.state, cipherSuite: session.suite }, {
    extraProposals: [{ proposalType: 'add', add: { keyPackage } }],
    ratchetTreeExtension: true,
  })
  if (!result.welcome) throw new Error('MLS Add did not produce a Welcome')
  const commit = encodeMlsMessage(result.commit)
  const welcome = encodeMlsMessage({
    version: 'mls10', wireformat: 'mls_welcome', welcome: result.welcome,
  })
  result.consumed.forEach(zeroOutUint8Array)
  return {
    next: { ...session, state: result.newState },
    commit, welcome, epoch: Number(result.newState.groupContext.epoch),
  }
}

export async function joinExperimentalMLSGroup(
  conversationId: number,
  device: ExperimentalMLSDevice,
  welcome: Uint8Array,
  suite: CiphersuiteImpl,
  trust: ExperimentalMLSTrust,
): Promise<ExperimentalMLSSession> {
  trust.require(device.userId, device.deviceId, device.publicPackage.leafNode.signaturePublicKey)
  const decoded = decodeFull(welcome)
  if (decoded.wireformat !== 'mls_welcome') throw new Error('Expected MLS Welcome')
  const state = await joinGroup(
    decoded.welcome, device.publicPackage, device.privatePackage, emptyPskIndex,
    suite, undefined, undefined, trust.config,
  )
  if (!same(state.groupContext.groupId, conversationGroupID(conversationId))) {
    throw new Error('Welcome belongs to a different conversation')
  }
  return { state, suite }
}

export async function encryptExperimentalMLSMessage(
  session: ExperimentalMLSSession,
  plaintext: Uint8Array,
): Promise<{ next: ExperimentalMLSSession; ciphertext: Uint8Array; epoch: number }> {
  if (plaintext.length < 1 || plaintext.length > MAX_MESSAGE_BYTES) {
    throw new Error('Invalid MLS plaintext size')
  }
  const result = await createApplicationMessage(session.state, plaintext, session.suite)
  const ciphertext = encodeMlsMessage({
    version: 'mls10', wireformat: 'mls_private_message',
    privateMessage: result.privateMessage,
  })
  result.consumed.forEach(zeroOutUint8Array)
  return {
    next: { ...session, state: result.newState },
    ciphertext, epoch: Number(result.newState.groupContext.epoch),
  }
}

export async function receiveExperimentalMLSMessage(
  session: ExperimentalMLSSession,
  ciphertext: Uint8Array,
): Promise<{ next: ExperimentalMLSSession; plaintext: Uint8Array }> {
  const wire = decodeFull(ciphertext)
  if (wire.wireformat !== 'mls_private_message') throw new Error('Expected MLS ciphertext')
  const result = await processPrivateMessage(
    session.state, wire.privateMessage, emptyPskIndex, session.suite,
  )
  if (result.kind !== 'applicationMessage') throw new Error('MLS payload was not a chat message')
  result.consumed.forEach(zeroOutUint8Array)
  return {
    next: { ...session, state: result.newState },
    plaintext: result.message,
  }
}

export async function applyExperimentalMLSCommit(
  session: ExperimentalMLSSession,
  commit: Uint8Array,
): Promise<ExperimentalMLSSession> {
  const wire = decodeFull(commit)
  if (wire.wireformat !== 'mls_private_message' && wire.wireformat !== 'mls_public_message') {
    throw new Error('Expected MLS Commit')
  }
  // acceptAll accepts proposals for the POC only. Group-policy authorization
  // and app-level membership validation MUST replace it before production.
  const result = await processMessage(wire, session.state, emptyPskIndex, acceptAll, session.suite)
  if (result.kind !== 'newState') throw new Error('Expected MLS handshake')
  result.consumed.forEach(zeroOutUint8Array)
  return { ...session, state: result.newState }
}
