export const CALL_TRANSLATION_TOPIC = 'chatnet.call.translation.v1'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const maxTranscriptLength = 600

export type CallTranscript = {
  id: string
  text: string
  sourceLanguage: string
  sentAt: number
}

type EncryptedTranscript = {
  version: 1
  iv: string
  ciphertext: string
}

export function createCallTranscript(text: string, sourceLanguage: string): CallTranscript | null {
  const normalized = text.replace(/\s+/g, ' ').trim().slice(0, maxTranscriptLength)
  const language = sourceLanguage.trim().toLowerCase().split('-')[0]
  if (!normalized || !/^[a-z]{2,3}$/.test(language)) return null
  return {
    id: crypto.randomUUID(),
    text: normalized,
    sourceLanguage: language,
    sentAt: Date.now(),
  }
}

export async function encryptCallTranscript(
  transcript: CallTranscript,
  mediaKey: Uint8Array,
  callId: string,
) {
  const key = await importMediaKey(mediaKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(`chatnet-caption:${callId}`) },
    key,
    encoder.encode(JSON.stringify(transcript)),
  )
  const payload: EncryptedTranscript = {
    version: 1,
    iv: toBase64URL(iv),
    ciphertext: toBase64URL(new Uint8Array(ciphertext)),
  }
  return encoder.encode(JSON.stringify(payload))
}

export async function decryptCallTranscript(
  payload: Uint8Array,
  mediaKey: Uint8Array,
  callId: string,
): Promise<CallTranscript | null> {
  if (payload.byteLength > 4096) return null
  try {
    const encrypted = JSON.parse(decoder.decode(payload)) as Partial<EncryptedTranscript>
    if (encrypted.version !== 1 || typeof encrypted.iv !== 'string' || typeof encrypted.ciphertext !== 'string') {
      return null
    }
    const iv = fromBase64URL(encrypted.iv)
    const ciphertext = fromBase64URL(encrypted.ciphertext)
    if (iv.byteLength !== 12 || ciphertext.byteLength < 17 || ciphertext.byteLength > 3072) return null
    const key = await importMediaKey(mediaKey)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode(`chatnet-caption:${callId}`) },
      key,
      toArrayBuffer(ciphertext),
    )
    return parseTranscript(JSON.parse(decoder.decode(plaintext)))
  } catch {
    return null
  }
}

function parseTranscript(value: unknown): CallTranscript | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<CallTranscript>
  if (
    typeof item.id !== 'string' ||
    !/^[0-9a-f-]{20,64}$/i.test(item.id) ||
    typeof item.text !== 'string' ||
    !item.text.trim() ||
    item.text.length > maxTranscriptLength ||
    typeof item.sourceLanguage !== 'string' ||
    !/^[a-z]{2,3}$/.test(item.sourceLanguage) ||
    typeof item.sentAt !== 'number' ||
    Math.abs(Date.now() - item.sentAt) > 5 * 60_000
  ) return null
  return {
    id: item.id,
    text: item.text.replace(/\s+/g, ' ').trim(),
    sourceLanguage: item.sourceLanguage,
    sentAt: item.sentAt,
  }
}

function importMediaKey(mediaKey: Uint8Array) {
  if (mediaKey.byteLength !== 32) throw new Error('Invalid call media key')
  return crypto.subtle.importKey('raw', toArrayBuffer(mediaKey), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function toArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
}

function toBase64URL(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64URL(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}
