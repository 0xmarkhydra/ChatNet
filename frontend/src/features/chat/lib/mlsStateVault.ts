import { decodeGroupState, encodeGroupState, type ClientState } from 'ts-mls'
import type { ClientConfig } from 'ts-mls/clientConfig.js'
import { getOwnLeafNode } from 'ts-mls/clientState.js'
import type { PrivateKeyPackage } from 'ts-mls/keyPackage.js'
import type { SignedMLSEvent } from './mlsTransport'

// Experimental MLS storage: AES-GCM sealed group state in browser IndexedDB.
// The non-extractable vault key stays in IndexedDB. This protects bytes at
// rest, NOT against same-origin XSS, an infected browser or device compromise.
// Never use this as a cross-device backup or server-side key escrow.
const DB_NAME = 'chatnet-mls-state-v1'
const GROUPS = 'groups'
const KEYS = 'keys'
const PACKAGES = 'packages'
const HISTORY = 'history'
const PENDING = 'pending'
const TRUST = 'trust'
const VERSION = 2
const GROUP_ID_PREFIX = 'chatnet:mls:conversation:v1:'
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const utf8 = new TextEncoder()

export type MLSStateSnapshot = { state: ClientState; revision: number; cursor: number }

type SealedState = {
  id: string
  epoch: string
  revision: number
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
  cursor?: number
}
type VaultKey = { id: string; cryptoKey: CryptoKey }

function keyId(userId: number, deviceId: string): string {
  if (!Number.isSafeInteger(userId) || userId < 1 || !DEVICE_RE.test(deviceId)) {
    throw new Error('Invalid MLS vault identity')
  }
  return `${userId}:${deviceId}`
}
function stateId(userId: number, deviceId: string, conversationId: number): string {
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    throw new Error('Invalid MLS conversation')
  }
  return `${keyId(userId, deviceId)}:${conversationId}`
}
function epochOf(state: ClientState, userId: number, deviceId: string, conversationId: number): string {
  const expected = utf8.encode(GROUP_ID_PREFIX + conversationId)
  const actual = state.groupContext.groupId
  if (actual.length !== expected.length || actual.some((byte, index) => byte !== expected[index])) {
    throw new Error('MLS group belongs to another conversation')
  }
  if (state.groupContext.epoch < 0n) throw new Error('Invalid MLS epoch')
  if (state.groupActiveState.kind === 'active') {
    const leaf = getOwnLeafNode(state)
    if (leaf.credential.credentialType !== 'basic' ||
        new TextDecoder('utf-8', { fatal: true }).decode(leaf.credential.identity) !==
          `chatnet:mls:device:v1:${userId}:${deviceId}`) {
      throw new Error('MLS signing credential does not belong to this device')
    }
  }
  return String(state.groupContext.epoch)
}
function aad(id: string, epoch: string, revision: number): Uint8Array<ArrayBuffer> {
  return utf8.encode(`chatnet:mls:state:v1:${id}:${epoch}:${revision}`)
}

function openVault(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('MLS browser storage unavailable'))
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(GROUPS)) db.createObjectStore(GROUPS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PACKAGES)) db.createObjectStore(PACKAGES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(HISTORY)) db.createObjectStore(HISTORY, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(TRUST)) db.createObjectStore(TRUST, { keyPath: 'id' })
    }
    request.onerror = () => reject(new Error('Cannot open MLS vault'))
    request.onblocked = () => reject(new Error('Close other ChatNet tabs to update MLS vault'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function withVault<T>(
  stores: string[],
  mode: IDBTransactionMode,
  callback: (tx: IDBTransaction, result: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await openVault()
  return new Promise<T>((resolve, reject) => {
    let settled = false
    let observed = false
    let value!: T
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      db.close()
      if (err) reject(err)
      else if (observed) resolve(value)
      else reject(new Error('MLS vault transaction incomplete'))
    }
    try {
      const tx = db.transaction(stores, mode)
      tx.oncomplete = () => finish()
      tx.onabort = () => finish(new Error('MLS vault transaction aborted'))
      tx.onerror = () => finish(new Error('MLS vault transaction failed'))
      callback(tx, result => { value = result; observed = true }, err => {
        try { tx.abort() } catch { /* transaction already finished */ }
        finish(err)
      })
    } catch {
      db.close()
      reject(new Error('Cannot access MLS vault'))
    }
  })
}

async function loadOrCreateKey(id: string): Promise<CryptoKey> {
  const existing = await withVault<CryptoKey | null>([KEYS], 'readonly', (tx, result) => {
    const request = tx.objectStore(KEYS).get(id)
    request.onsuccess = () => result((request.result as VaultKey | undefined)?.cryptoKey ?? null)
  })
  if (existing) return existing
  const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const outcome = await withVault<CryptoKey>([KEYS], 'readwrite', (tx, result) => {
    const store = tx.objectStore(KEYS)
    const request = store.get(id)
    request.onsuccess = () => {
      const current = (request.result as VaultKey | undefined)?.cryptoKey
      if (current) {
        result(current)
        return
      }
      store.add({ id, cryptoKey: generated } satisfies VaultKey)
      result(generated)
    }
  })
  if (outcome.extractable || outcome.algorithm.name !== 'AES-GCM') {
    throw new Error('Unsafe MLS vault key')
  }
  return outcome
}

export async function saveMLSState(
  userId: number,
  deviceId: string,
  conversationId: number,
  state: ClientState,
  expectedRevision: number,
): Promise<number> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Invalid MLS state revision')
  }
  const id = stateId(userId, deviceId, conversationId)
  const epoch = epochOf(state, userId, deviceId, conversationId)
  const revision = expectedRevision + 1
  const key = await loadOrCreateKey(keyId(userId, deviceId))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new Uint8Array(encodeGroupState(state))
  let ciphertext: ArrayBuffer
  try {
    ciphertext = await crypto.subtle.encrypt({
      name: 'AES-GCM', iv, additionalData: aad(id, epoch, revision),
    }, key, encoded)
  } finally {
    // The serialization buffer is independent of state; it may be wiped here.
    encoded.fill(0)
  }

  // Read+CAS+write inside one IndexedDB transaction so a stale tab cannot
  // roll back the MLS state after another tab advanced its message ratchet.
  return withVault<number>([GROUPS], 'readwrite', (tx, result, fail) => {
    const store = tx.objectStore(GROUPS)
    const request = store.get(id)
    request.onsuccess = () => {
      const current = request.result as SealedState | undefined
      if ((!current && expectedRevision !== 0) ||
          (current && (current.revision !== expectedRevision || BigInt(current.epoch) > BigInt(epoch)))) {
        fail(new Error('MLS state changed in another tab; synchronize before sending'))
        return
      }
      store.put({ id, epoch, revision, iv, ciphertext } satisfies SealedState)
      result(revision)
    }
  })
}

export async function loadMLSState(
  userId: number,
  deviceId: string,
  conversationId: number,
  clientConfig: ClientConfig,
): Promise<MLSStateSnapshot | null> {
  const id = stateId(userId, deviceId, conversationId)
  const sealed = await withVault<SealedState | null>([GROUPS], 'readonly', (tx, result) => {
    const request = tx.objectStore(GROUPS).get(id)
    request.onsuccess = () => result(request.result ?? null)
  })
  if (!sealed) return null
  if (!Number.isSafeInteger(sealed.revision) || sealed.revision < 1 ||
      !/^(0|[1-9]\d*)$/.test(sealed.epoch)) {
    throw new Error('MLS stored state metadata is invalid')
  }
  const key = await withVault<CryptoKey | null>([KEYS], 'readonly', (tx, result) => {
    const request = tx.objectStore(KEYS).get(keyId(userId, deviceId))
    request.onsuccess = () => result((request.result as VaultKey | undefined)?.cryptoKey ?? null)
  })
  if (!key) throw new Error('MLS group secret key is missing')
  let bytes: ArrayBuffer
  try {
    bytes = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: sealed.iv,
      additionalData: aad(id, sealed.epoch, sealed.revision),
    }, key, sealed.ciphertext)
  } catch {
    throw new Error('MLS state is unavailable or authentication failed')
  }
  const encoded = new Uint8Array(bytes)
  try {
    const decoded = decodeGroupState(encoded, 0)
    if (!decoded) throw new Error('Invalid encoded MLS state')
    const [groupState, consumed] = decoded
    if (consumed !== encoded.length) throw new Error('Trailing bytes in MLS state')
    const state: ClientState = { ...groupState, clientConfig }
    if (epochOf(state, userId, deviceId, conversationId) !== sealed.epoch) {
      throw new Error('MLS group epoch does not match persisted state')
    }
    return { state, revision: sealed.revision, cursor: sealed.cursor ?? 0 }
  } catch {
    throw new Error('Stored MLS state cannot be decoded; do not downgrade to plaintext')
  }
  // MLS binary decoder retains subarray views into encoded. Do not zero this
  // buffer while the returned state still references its secret bytes.
}


export type MLSLocalMessage = {
  id: number
  senderId: number
  text: string
  createdAt: string
  clientId: string
}
export type MLSPending =
  | { kind: 'bootstrap'; commit: SignedMLSEvent; welcome: SignedMLSEvent }
  | { kind: 'application'; event: SignedMLSEvent; text: string; createdAt: string }

type EncryptedRecord = {
  id: string
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
}

function encodeBinary(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function decodeBinary(value: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid encrypted MLS record')
  }
  return new Uint8Array(Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    char => char.charCodeAt(0),
  ))
}
async function encryptRecord(
  key: CryptoKey,
  identity: string,
  value: unknown,
): Promise<EncryptedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = utf8.encode(JSON.stringify(value))
  try {
    const ciphertext = await crypto.subtle.encrypt({
      name: 'AES-GCM', iv, additionalData: utf8.encode('chatnet:mls:sealed:v1:' + identity),
    }, key, plain)
    return { id: identity, iv, ciphertext }
  } finally {
    plain.fill(0)
  }
}
async function decryptRecord<T>(key: CryptoKey, item: EncryptedRecord): Promise<T> {
  const buffer = await crypto.subtle.decrypt({
    name: 'AES-GCM', iv: item.iv,
    additionalData: utf8.encode('chatnet:mls:sealed:v1:' + item.id),
  }, key, item.ciphertext)
  const data = new Uint8Array(buffer)
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)) as T
  } finally {
    data.fill(0)
  }
}

export async function saveMLSDevicePackage(
  userId: number,
  deviceId: string,
  keyPackageBytes: Uint8Array,
  privatePackage: PrivateKeyPackage,
): Promise<void> {
  const id = keyId(userId, deviceId)
  if (keyPackageBytes.length < 64 || keyPackageBytes.length > 16384 ||
      privatePackage.initPrivateKey.length === 0 ||
      privatePackage.hpkePrivateKey.length === 0 ||
      privatePackage.signaturePrivateKey.length === 0) {
    throw new Error('Invalid MLS KeyPackage private material')
  }
  const key = await loadOrCreateKey(id)
  const item = await encryptRecord(key, id, {
    publicBytes: encodeBinary(keyPackageBytes),
    init: encodeBinary(privatePackage.initPrivateKey),
    hpke: encodeBinary(privatePackage.hpkePrivateKey),
    signature: encodeBinary(privatePackage.signaturePrivateKey),
  })
  await withVault<void>([PACKAGES], 'readwrite', (tx, result, fail) => {
    const store = tx.objectStore(PACKAGES)
    const request = store.get(id)
    request.onsuccess = () => {
      if (request.result) {
        fail(new Error('Existing MLS private KeyPackage must not be silently replaced'))
        return
      }
      store.add(item)
      result(undefined)
    }
  })
}

export async function loadMLSDevicePackage(
  userId: number,
  deviceId: string,
): Promise<{ keyPackageBytes: Uint8Array; privatePackage: PrivateKeyPackage } | null> {
  const id = keyId(userId, deviceId)
  const item = await withVault<EncryptedRecord | null>([PACKAGES], 'readonly', (tx, result) => {
    const request = tx.objectStore(PACKAGES).get(id)
    request.onsuccess = () => result(request.result ?? null)
  })
  if (!item) return null
  const key = await loadOrCreateKey(id)
  const parsed = await decryptRecord<{publicBytes:string;init:string;hpke:string;signature:string}>(key, item)
  const raw = decodeBinary(parsed.publicBytes)
  if (raw.length < 64 || raw.length > 16384) throw new Error('Invalid stored MLS KeyPackage')
  return {
    keyPackageBytes: raw,
    privatePackage: {
      initPrivateKey: decodeBinary(parsed.init),
      hpkePrivateKey: decodeBinary(parsed.hpke),
      signaturePrivateKey: decodeBinary(parsed.signature),
    },
  }
}

function peerTrustID(userId: number, deviceId: string, peerUserId: number, peerDeviceId: string): string {
  if (!Number.isSafeInteger(peerUserId) || peerUserId < 1) {
    throw new Error('Invalid peer account')
  }
  return keyId(userId, deviceId) + ':' + keyId(peerUserId, peerDeviceId)
}
export async function getPinnedMLSPeer(
  userId: number, deviceId: string, peerUserId: number, peerDeviceId: string,
): Promise<{ identityKey: string; mlsSigningKey?: string } | null> {
  const id = peerTrustID(userId, deviceId, peerUserId, peerDeviceId)
  return withVault<{ identityKey: string; mlsSigningKey?: string } | null>([TRUST], 'readonly', (tx, result) => {
    const request = tx.objectStore(TRUST).get(id)
    request.onsuccess = () => {
      const value = request.result
      result(value ? { identityKey: value.identityKey, mlsSigningKey: value.mlsSigningKey } : null)
    }
  })
}
export async function pinMLSPeer(
  userId: number, deviceId: string, peerUserId: number, peerDeviceId: string,
  identityKey: string,
  mlsSigningKey?: string,
): Promise<void> {
  if (decodeBinary(identityKey).length !== 32 ||
      (mlsSigningKey && decodeBinary(mlsSigningKey).length !== 32)) {
    throw new Error('Invalid verified peer public key')
  }
  const id = peerTrustID(userId, deviceId, peerUserId, peerDeviceId)
  await withVault<void>([TRUST], 'readwrite', (tx, result, fail) => {
    const store = tx.objectStore(TRUST)
    const request = store.get(id)
    request.onsuccess = () => {
      const existing = request.result?.identityKey as string | undefined
      if (existing && existing !== identityKey) {
        fail(new Error('Peer identity changed; verify out-of-band before continuing'))
        return
      }
      const priorSigning = request.result?.mlsSigningKey as string | undefined
      if (priorSigning && mlsSigningKey && priorSigning !== mlsSigningKey) {
        fail(new Error('Peer MLS signing identity changed; manual verification required'))
        return
      }
      if (!existing) store.add({ id, identityKey, mlsSigningKey })
      else if (!priorSigning && mlsSigningKey) store.put({ id, identityKey, mlsSigningKey })
      result(undefined)
    }
  })
}

// Atomic ratchet/state + inbox history + signed outbox. The next MLS secret
// ratchet and the event that consumes it MUST survive or fail together.
export async function persistMLSProgress(
  userId: number,
  deviceId: string,
  conversationId: number,
  state: ClientState,
  expectedRevision: number,
  cursor: number,
  options: { history?: MLSLocalMessage; pending?: MLSPending; clearPending?: boolean } = {},
): Promise<number> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      expectedRevision >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(cursor) || cursor < 0) {
    throw new Error('Invalid MLS progress')
  }
  const id = stateId(userId, deviceId, conversationId)
  const epoch = epochOf(state, userId, deviceId, conversationId)
  const key = await loadOrCreateKey(keyId(userId, deviceId))
  const revision = expectedRevision + 1
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new Uint8Array(encodeGroupState(state))
  let ciphertext: ArrayBuffer
  try {
    ciphertext = await crypto.subtle.encrypt({
      name: 'AES-GCM', iv, additionalData: aad(id, epoch, revision),
    }, key, encoded)
  } finally {
    encoded.fill(0)
  }
  const pendingRecord = options.pending
    ? await encryptRecord(key, id + ':pending', options.pending)
    : null
  let historyRecord: EncryptedRecord | null = null
  if (options.history) {
    if (!Number.isSafeInteger(options.history.id) || options.history.id < 1 ||
        !Number.isSafeInteger(options.history.senderId) || options.history.senderId < 1 ||
        typeof options.history.text !== 'string' || options.history.text.length > 16000 ||
        !/^[a-f0-9-]{36}$/.test(options.history.clientId)) {
      throw new Error('Invalid MLS local message')
    }
    const historyID = id + ':' + options.history.id
    historyRecord = await encryptRecord(key, historyID, options.history)
  }
  return withVault<number>([GROUPS, HISTORY, PENDING], 'readwrite', (tx, result, fail) => {
    const groups = tx.objectStore(GROUPS)
    const request = groups.get(id)
    request.onsuccess = () => {
      const current = request.result as SealedState | undefined
      if ((!current && expectedRevision !== 0) ||
          (current && (current.revision !== expectedRevision ||
            BigInt(current.epoch) > BigInt(epoch) || (current.cursor ?? 0) > cursor))) {
        fail(new Error('MLS state changed in another tab; synchronize before sending'))
        return
      }
      const pendingStore = tx.objectStore(PENDING)
      const pendingRequest = pendingStore.get(id)
      pendingRequest.onsuccess = () => {
        const currentPending = pendingRequest.result as EncryptedRecord | undefined
        if (options.pending && currentPending) {
          fail(new Error('Outstanding MLS event must be resolved before encrypting again'))
          return
        }
        groups.put({ id, epoch, revision, cursor, iv, ciphertext } satisfies SealedState)
        if (historyRecord) tx.objectStore(HISTORY).put(historyRecord)
        if (pendingRecord) pendingStore.put({ ...pendingRecord, id })
        if (options.clearPending) pendingStore.delete(id)
        result(revision)
      }
    }
  })
}

export async function loadMLSPending(
  userId: number, deviceId: string, conversationId: number,
): Promise<MLSPending | null> {
  const id = stateId(userId, deviceId, conversationId)
  const item = await withVault<EncryptedRecord | null>([PENDING], 'readonly', (tx, result) => {
    const request = tx.objectStore(PENDING).get(id)
    request.onsuccess = () => result(request.result ?? null)
  })
  if (!item) return null
  const key = await loadOrCreateKey(keyId(userId, deviceId))
  return decryptRecord<MLSPending>(key, { ...item, id: id + ':pending' })
}

export async function listMLSLocalMessages(
  userId: number, deviceId: string, conversationId: number,
): Promise<MLSLocalMessage[]> {
  const prefix = stateId(userId, deviceId, conversationId) + ':'
  const stored = await withVault<EncryptedRecord[]>([HISTORY], 'readonly', (tx, result) => {
    const request = tx.objectStore(HISTORY).getAll()
    request.onsuccess = () => result((request.result as EncryptedRecord[]).filter(
      entry => entry.id.startsWith(prefix),
    ).slice(-300))
  })
  if (stored.length === 0) return []
  const key = await loadOrCreateKey(keyId(userId, deviceId))
  const items = await Promise.all(stored.map(item => decryptRecord<MLSLocalMessage>(key, item)))
  return items.sort((a, b) => a.id - b.id)
}

// Deleting a local group means permanently losing access until authorized
// re-enrollment. This is NEVER called on logout/refresh automatically.
export async function deleteMLSState(userId: number, deviceId: string, conversationId: number): Promise<void> {
  const id = stateId(userId, deviceId, conversationId)
  await withVault<void>([GROUPS], 'readwrite', (tx, result) => {
    tx.objectStore(GROUPS).delete(id)
    result(undefined)
  })
}
