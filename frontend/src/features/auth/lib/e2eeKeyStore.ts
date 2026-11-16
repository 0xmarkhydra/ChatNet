import type { E2EEDeviceIdentity } from './e2eeIdentity'

// Web/PWA experimental key vault. IndexedDB can structured-clone a
// non-extractable CryptoKey; it cannot protect against XSS or malicious JS.
// No automatic enrollment, recovery or server-side escrow is performed.
const DATABASE = 'chatnet-e2ee-device-keys-v1'
const OBJECT_STORE = 'identities'

type SavedIdentity = {
  id: string
  userId: number
  deviceId: string
  identityKey: string
  privateKey: CryptoKey
}

export type LocalE2EEIdentity = E2EEDeviceIdentity & { deviceId: string }

function validateUser(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Invalid E2EE identity owner')
}

function recordKey(userId: number, deviceId: string): string {
  validateUser(userId)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId)) {
    throw new Error('Invalid E2EE device ID')
  }
  return `${userId}:${deviceId}`
}

function openE2EEDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Browser key storage is unavailable'))
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OBJECT_STORE)) {
        db.createObjectStore(OBJECT_STORE, { keyPath: 'id' }).createIndex('userId', 'userId')
      }
    }
    request.onerror = () => reject(new Error('Cannot open encrypted messaging key storage'))
    request.onblocked = () => reject(new Error('Close other app tabs to update key storage'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, respond: (value: T) => void) => void,
): Promise<T> {
  const db = await openE2EEDatabase()
  return new Promise<T>((resolve, reject) => {
    let value: T
    let reported = false
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      db.close()
      if (err) reject(err)
      else if (reported) resolve(value)
      else reject(new Error('E2EE key storage did not complete'))
    }
    let transaction: IDBTransaction
    try {
      transaction = db.transaction(OBJECT_STORE, mode)
      transaction.oncomplete = () => finish()
      transaction.onabort = () => finish(new Error('E2EE device key transaction aborted'))
      transaction.onerror = () => finish(new Error('E2EE device key transaction failed'))
      action(transaction.objectStore(OBJECT_STORE), result => {
        value = result
        reported = true
      })
    } catch {
      db.close()
      reject(new Error('Cannot access E2EE key storage'))
    }
  })
}

// Verify that the public key really corresponds to the provided non-exportable
// signing key; otherwise a client could persist an unusable device identity.
async function assertValidIdentity(identity: E2EEDeviceIdentity): Promise<void> {
  const privateKey = identity.privateKey
  if (privateKey.extractable || privateKey.algorithm.name !== 'Ed25519' ||
      !privateKey.usages.includes('sign')) {
    throw new Error('Device identity must use a non-exportable Ed25519 signing key')
  }
  try {
    const publicBytes = Uint8Array.from(
      atob(identity.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
      char => char.charCodeAt(0),
    )
    if (publicBytes.length !== 32) throw new Error('Invalid public key')
    const publicKey = await crypto.subtle.importKey('raw', publicBytes, 'Ed25519', false, ['verify'])
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const signed = await crypto.subtle.sign('Ed25519', privateKey, challenge)
    if (!await crypto.subtle.verify('Ed25519', publicKey, signed, challenge)) {
      throw new Error('Device identity key mismatch')
    }
  } catch {
    throw new Error('Invalid E2EE device identity pair')
  }
}

export async function saveLocalE2EEIdentity(
  userId: number,
  identity: LocalE2EEIdentity,
): Promise<void> {
  const id = recordKey(userId, identity.deviceId)
  await assertValidIdentity(identity)
  await withStore<void>('readwrite', (store, respond) => {
    // add() refuses accidental replacement of an existing private key.
    store.add({
      id, userId, deviceId: identity.deviceId,
      identityKey: identity.publicKey, privateKey: identity.privateKey,
    } satisfies SavedIdentity)
    respond(undefined)
  })
}

export async function loadLocalE2EEIdentity(
  userId: number,
  deviceId: string,
): Promise<E2EEDeviceIdentity | null> {
  const id = recordKey(userId, deviceId)
  const saved = await withStore<SavedIdentity | null>('readonly', (store, respond) => {
    const request = store.get(id)
    request.onsuccess = () => respond(request.result ?? null)
  })
  if (!saved) return null
  if (saved.userId !== userId || saved.deviceId !== deviceId) {
    throw new Error('E2EE key storage owner mismatch')
  }
  const identity = { publicKey: saved.identityKey, privateKey: saved.privateKey }
  await assertValidIdentity(identity)
  return identity
}

export async function listLocalE2EEDeviceIDs(userId: number): Promise<string[]> {
  validateUser(userId)
  return withStore<string[]>('readonly', (store, respond) => {
    const request = store.index('userId').getAll(userId)
    request.onsuccess = () => respond((request.result as SavedIdentity[]).map(x => x.deviceId))
  })
}

export async function deleteLocalE2EEIdentity(userId: number, deviceId: string): Promise<void> {
  const id = recordKey(userId, deviceId)
  await withStore<void>('readwrite', (store, respond) => {
    store.delete(id)
    respond(undefined)
  })
}
