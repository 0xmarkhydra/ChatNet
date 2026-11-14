// Experimental MLS opaque transport. The actual MLS engine must create,
// validate and process every MLS wire-format message before using this adapter.
// This module never encrypts chat plaintext and must not be used as a fallback.
export type MLSRelayKind = 'commit' | 'application' | 'welcome'

export type SignedMLSEvent = {
  deviceId: string
  clientId: string
  eventType: MLSRelayKind
  epoch: number
  targetDeviceId?: string
  payload: string
  signature: string
}

export type ReceivedMLSEvent = SignedMLSEvent & {
  id: number
  conversationId: number
  senderId: number
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const MAX_MLS_RELAY_BYTES = 131072

function encodeBase64URL(raw: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < raw.byteLength; i += 16384) {
    binary += String.fromCharCode(...raw.subarray(i, i + 16384))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeMLSPayload(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > 174764) {
    throw new Error('Invalid MLS ciphertext encoding')
  }
  const raw = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
  if (raw.byteLength < 32 || raw.byteLength > MAX_MLS_RELAY_BYTES ||
      encodeBase64URL(raw) !== encoded) {
    throw new Error('Invalid MLS ciphertext')
  }
  return raw
}


export async function verifyMLSTransportEvent(
  event: ReceivedMLSEvent,
  expectedConversationId: number,
  expectedSenderUserId: number,
  verifiedDevicePublicKey: string,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(event.id) || event.id < 1 ||
      event.conversationId !== expectedConversationId ||
      event.senderId !== expectedSenderUserId ||
      !UUID_RE.test(event.deviceId) || !UUID_RE.test(event.clientId) ||
      !Number.isSafeInteger(event.epoch) || event.epoch < 1 ||
      !['commit', 'application', 'welcome'].includes(event.eventType) ||
      (event.eventType === 'welcome' && !UUID_RE.test(event.targetDeviceId || '')) ||
      (event.eventType !== 'welcome' && event.targetDeviceId)) {
    throw new Error('Invalid MLS delivery identity or epoch')
  }
  const bytes = decodeMLSPayload(event.payload)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))
  const transcript = [
    'chatnet:e2ee:mls:relay:v1', String(expectedSenderUserId),
    String(expectedConversationId), event.deviceId, event.clientId,
    event.eventType, String(event.epoch), event.targetDeviceId ?? '',
    encodeBase64URL(digest),
  ].join('\n')
  const fromB64 = (value: string, size: number): Uint8Array<ArrayBuffer> => {
    if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 128) {
      throw new Error('Invalid MLS device proof')
    }
    const decoded = new Uint8Array(Uint8Array.from(
      atob(value.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    ))
    if (decoded.length !== size || encodeBase64URL(decoded) !== value) {
      throw new Error('Invalid MLS device proof size')
    }
    return decoded
  }
  const key = await crypto.subtle.importKey('raw', fromB64(verifiedDevicePublicKey, 32),
    'Ed25519', false, ['verify'])
  const valid = await crypto.subtle.verify('Ed25519', key,
    fromB64(event.signature, 64), new TextEncoder().encode(transcript))
  if (!valid) throw new Error('MLS delivery signature does not match pinned device')
  return bytes
}

export async function signMLSTransportEvent(input: {
  userId: number
  conversationId: number
  deviceId: string
  privateKey: CryptoKey
  eventType: MLSRelayKind
  epoch: number
  targetDeviceId?: string
  mlsWireMessage: Uint8Array
  clientId?: string
}): Promise<SignedMLSEvent> {
  const target = input.targetDeviceId ?? ''
  const clientId = input.clientId ?? crypto.randomUUID()
  if (!Number.isSafeInteger(input.userId) || input.userId < 1 ||
      !Number.isSafeInteger(input.conversationId) || input.conversationId < 1 ||
      !Number.isSafeInteger(input.epoch) || input.epoch < 1 ||
      !UUID_RE.test(input.deviceId) || !UUID_RE.test(clientId) ||
      (input.eventType !== 'commit' && input.eventType !== 'application' && input.eventType !== 'welcome') ||
      (input.eventType === 'welcome' ? !UUID_RE.test(target) : target !== '') ||
      input.mlsWireMessage.byteLength < 32 ||
      input.mlsWireMessage.byteLength > MAX_MLS_RELAY_BYTES) {
    throw new Error('Invalid MLS transport request')
  }
  const wire = new Uint8Array(input.mlsWireMessage)
  const digest = await crypto.subtle.digest('SHA-256', wire)
  const transcript = [
    'chatnet:e2ee:mls:relay:v1', String(input.userId), String(input.conversationId),
    input.deviceId, clientId, input.eventType, String(input.epoch),
    target, encodeBase64URL(new Uint8Array(digest)),
  ].join('\n')
  const signature = await crypto.subtle.sign(
    'Ed25519', input.privateKey, new TextEncoder().encode(transcript),
  )
  return {
    deviceId: input.deviceId, clientId, eventType: input.eventType, epoch: input.epoch,
    ...(target ? { targetDeviceId: target } : {}),
    payload: encodeBase64URL(wire),
    signature: encodeBase64URL(new Uint8Array(signature)),
  }
}
