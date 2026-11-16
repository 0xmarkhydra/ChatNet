// Experimental client-only attachment cipher. The key + manifest must travel inside
// an authenticated MLS application message before this can be used for real chat.
export const ATTACHMENT_CHUNK_BYTES = 4 * 1024 * 1024
const MAX_PLAINTEXT_BYTES = 150 * 1024 * 1024
const GCM_TAG_BYTES = 16
const NONCE_PREFIX_BYTES = 8

export type EncryptedAttachmentManifest = {
  version: 1
  algorithm: 'AES-256-GCM-CHUNKED'
  name: string
  contentType: string
  plaintextBytes: number
  ciphertextBytes: number
  chunkSize: number
  chunkCount: number
  noncePrefix: string
}

function encodePrefix(prefix: Uint8Array): string {
  return btoa(String.fromCharCode(...prefix)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodePrefix(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{11}$/.test(encoded)) throw new Error('Invalid attachment nonce')
  const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
  if (decoded.length !== NONCE_PREFIX_BYTES) throw new Error('Invalid attachment nonce')
  const prefix = Uint8Array.from(decoded, char => char.charCodeAt(0))
  if (encodePrefix(prefix) !== encoded) throw new Error('Invalid attachment nonce')
  return prefix
}

function nonce(prefix: Uint8Array, index: number): Uint8Array<ArrayBuffer> {
  const iv = new Uint8Array(12)
  iv.set(prefix)
  new DataView(iv.buffer).setUint32(NONCE_PREFIX_BYTES, index, false)
  return iv
}

function aad(manifest: EncryptedAttachmentManifest, index: number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify([
    'chatnet.e2ee.attachment.v1', manifest.name, manifest.contentType,
    manifest.plaintextBytes, manifest.chunkSize, manifest.chunkCount, index,
  ]))
}

function validateManifest(m: EncryptedAttachmentManifest): Uint8Array {
  if (m.version !== 1 || m.algorithm !== 'AES-256-GCM-CHUNKED' ||
      !m.name || m.name.length > 512 || m.contentType.length > 160 ||
      !Number.isSafeInteger(m.plaintextBytes) || m.plaintextBytes < 1 ||
      m.plaintextBytes > MAX_PLAINTEXT_BYTES || m.chunkSize !== ATTACHMENT_CHUNK_BYTES ||
      m.chunkCount !== Math.ceil(m.plaintextBytes / m.chunkSize) ||
      m.ciphertextBytes !== m.plaintextBytes + m.chunkCount * GCM_TAG_BYTES) {
    throw new Error('Invalid encrypted attachment manifest')
  }
  return decodePrefix(m.noncePrefix)
}

// Only the caller holding an authenticated MLS session may package fileKey
// and manifest for recipients. Never send them via presign/relay/S3 APIs.
export async function encryptAttachment(file: File): Promise<{
  ciphertext: Blob
  manifest: EncryptedAttachmentManifest
  fileKey: Uint8Array
}> {
  if (!file.name || file.name.length > 512 || file.type.length > 160 ||
      file.size < 1 || file.size > MAX_PLAINTEXT_BYTES) {
    throw new Error('Unsupported encrypted attachment')
  }

  const fileKey = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.importKey('raw', fileKey, 'AES-GCM', false, ['encrypt'])
  const prefix = crypto.getRandomValues(new Uint8Array(NONCE_PREFIX_BYTES))
  const chunkCount = Math.ceil(file.size / ATTACHMENT_CHUNK_BYTES)
  const manifest: EncryptedAttachmentManifest = {
    version: 1,
    algorithm: 'AES-256-GCM-CHUNKED',
    name: file.name,
    contentType: file.type,
    plaintextBytes: file.size,
    ciphertextBytes: file.size + chunkCount * GCM_TAG_BYTES,
    chunkSize: ATTACHMENT_CHUNK_BYTES,
    chunkCount,
    noncePrefix: encodePrefix(prefix),
  }
  const parts: BlobPart[] = []
  for (let index = 0; index < chunkCount; index++) {
    const start = index * ATTACHMENT_CHUNK_BYTES
    const plain = await file.slice(start, start + ATTACHMENT_CHUNK_BYTES).arrayBuffer()
    parts.push(await crypto.subtle.encrypt({
      name: 'AES-GCM', iv: nonce(prefix, index), additionalData: aad(manifest, index),
      tagLength: 128,
    }, key, plain))
  }
  return { ciphertext: new Blob(parts, { type: 'application/octet-stream' }), manifest, fileKey }
}

// Reject the entire file on any invalid tag/metadata/length: no partial output.
export async function decryptAttachment(
  ciphertext: Blob,
  manifest: EncryptedAttachmentManifest,
  fileKey: Uint8Array,
): Promise<Blob> {
  const prefix = validateManifest(manifest)
  if (ciphertext.size !== manifest.ciphertextBytes || fileKey.length !== 32) {
    throw new Error('Encrypted attachment size or key mismatch')
  }
  const key = await crypto.subtle.importKey('raw', new Uint8Array(fileKey), 'AES-GCM', false, ['decrypt'])
  const parts: BlobPart[] = []
  let offset = 0
  for (let index = 0; index < manifest.chunkCount; index++) {
    const plainLength = Math.min(manifest.chunkSize, manifest.plaintextBytes - index * manifest.chunkSize)
    const encryptedLength = plainLength + GCM_TAG_BYTES
    const encrypted = await ciphertext.slice(offset, offset + encryptedLength).arrayBuffer()
    parts.push(await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: nonce(prefix, index), additionalData: aad(manifest, index),
      tagLength: 128,
    }, key, encrypted))
    offset += encryptedLength
  }
  return new Blob(parts, { type: manifest.contentType })
}
