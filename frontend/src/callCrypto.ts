import type { E2EEPublicJWK } from './calls'

const encoder = new TextEncoder()

export type EphemeralCallKeyPair = {
  privateKey: CryptoKey
  publicKey: E2EEPublicJWK
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function generateEphemeralCallKeyPair(): Promise<EphemeralCallKeyPair> {
  if (!window.isSecureContext || !crypto?.subtle) throw new Error('E2EE requires a secure HTTPS browser context')
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  ) as CryptoKeyPair
  const exported = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  if (exported.kty !== 'EC' || exported.crv !== 'P-256' || !exported.x || !exported.y) {
    throw new Error('Browser returned an unsupported E2EE public key')
  }
  return {
    privateKey: keyPair.privateKey,
    publicKey: { kty: 'EC', crv: 'P-256', x: exported.x, y: exported.y },
  }
}

export function generateMediaKey() {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function generateKeyGeneration() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)))
}

async function importPeerPublicKey(publicKey: E2EEPublicJWK) {
  return crypto.subtle.importKey(
    'jwk',
    { ...publicKey, ext: true, key_ops: [] },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
}

async function deriveWrappingKey(
  privateKey: CryptoKey,
  peerPublicKey: E2EEPublicJWK,
  callId: string,
  senderUserId: number,
  recipientUserId: number,
) {
  const publicKey = await importPeerPublicKey(peerPublicKey)
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const hkdfMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF', hash: 'SHA-256',
      salt: encoder.encode(`chatnet-call:${callId}`),
      info: encoder.encode(`chatnet-e2ee-wrap:${senderUserId}:${recipientUserId}`),
    },
    hkdfMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function wrapMediaKey(
  mediaKey: Uint8Array,
  privateKey: CryptoKey,
  recipientPublicKey: E2EEPublicJWK,
  callId: string,
  senderUserId: number,
  recipientUserId: number,
) {
  const wrappingKey = await deriveWrappingKey(privateKey, recipientPublicKey, callId, senderUserId, recipientUserId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(`chatnet:${callId}:${senderUserId}:${recipientUserId}`) },
    wrappingKey,
    mediaKeyBuffer(mediaKey),
  )
  return { iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) }
}

export async function unwrapMediaKey(
  iv: string,
  ciphertext: string,
  privateKey: CryptoKey,
  senderPublicKey: E2EEPublicJWK,
  callId: string,
  senderUserId: number,
  recipientUserId: number,
) {
  const wrappingKey = await deriveWrappingKey(privateKey, senderPublicKey, callId, senderUserId, recipientUserId)
  const raw = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM', iv: base64UrlToBytes(iv),
      additionalData: encoder.encode(`chatnet:${callId}:${senderUserId}:${recipientUserId}`),
    },
    wrappingKey,
    base64UrlToBytes(ciphertext),
  )
  const key = new Uint8Array(raw)
  if (key.byteLength !== 32) throw new Error('Invalid media key length')
  return key
}

export function mediaKeyBuffer(key: Uint8Array) {
  return key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer
}
