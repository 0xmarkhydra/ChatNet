import type { ExternalE2EEKeyProvider } from 'livekit-client'
import {
  getE2EEEnvelope, listE2EEPublicKeys, putE2EEEnvelope, type CallRequest,
} from './calls'
import { mediaKeyBuffer, unwrapMediaKey, wrapMediaKey, type EphemeralCallKeyPair } from './callCrypto'

type CallKeySyncArgs = {
  request: CallRequest
  callId: string
  userId: number
  keyPair: EphemeralCallKeyPair
  keyProvider: ExternalE2EEKeyProvider
  hostMediaKey: Uint8Array | null
  hostGeneration: string
  hostWrappedKeys: Map<number, string>
  getLastEnvelopeGeneration: () => string
  setLastEnvelopeGeneration: (generation: string) => void
  isDisposed: () => boolean
  setDetail: (message: string) => void
}

export function createCallKeySynchronizers({
  request, callId, userId, keyPair, keyProvider, hostMediaKey, hostGeneration,
  hostWrappedKeys, getLastEnvelopeGeneration, setLastEnvelopeGeneration, isDisposed, setDetail,
}: CallKeySyncArgs) {
  let syncingHost = false
  const syncHostKeys = async () => {
    if (isDisposed() || syncingHost) return
    syncingHost = true
    try {
      const publicKeys = await listE2EEPublicKeys(request, callId)
      if (isDisposed()) return
      for (const record of publicKeys) {
        if (record.userId === userId) continue
        const fingerprint = `${record.updatedAt}:${hostGeneration}`
        if (hostWrappedKeys.get(record.userId) === fingerprint) continue
        const wrapped = await wrapMediaKey(hostMediaKey!, keyPair.privateKey, record.publicKey, callId, userId, record.userId)
        if (isDisposed()) return
        await putE2EEEnvelope(request, callId, {
          recipientUserId: record.userId,
          generation: hostGeneration,
          iv: wrapped.iv,
          ciphertext: wrapped.ciphertext,
        })
        if (isDisposed()) return
        hostWrappedKeys.set(record.userId, fingerprint)
      }
    } catch {
      // Retry on the next interval; never fall back to plaintext media.
    } finally { syncingHost = false }
  }
  let syncingParticipant = false
  const syncParticipantKey = async () => {
    if (isDisposed() || syncingParticipant) return
    syncingParticipant = true
    try {
      const result = await getE2EEEnvelope(request, callId)
      if (isDisposed()) return
      const envelope = result.envelope
      if (!envelope || envelope.generation === getLastEnvelopeGeneration()) return
      const keys = await listE2EEPublicKeys(request, callId)
      if (isDisposed()) return
      const sender = keys.find((item) => item.userId === envelope.senderUserId)
      if (!sender) return
      const key = await unwrapMediaKey(
        envelope.iv, envelope.ciphertext, keyPair.privateKey, sender.publicKey,
        callId, envelope.senderUserId, userId,
      )
      if (isDisposed()) return
      await keyProvider.setKey(mediaKeyBuffer(key))
      if (isDisposed()) return
      setLastEnvelopeGeneration(envelope.generation)
      setDetail('E2EE đã xoay khóa an toàn')
    } catch {
      // Keep the existing valid key and retry; do not downgrade encryption.
    } finally { syncingParticipant = false }
  }
  return { syncHostKeys, syncParticipantKey }
}