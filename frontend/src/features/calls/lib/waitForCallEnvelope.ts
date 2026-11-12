import { getE2EEEnvelope, listE2EEPublicKeys, type CallRequest } from './calls'
import { unwrapMediaKey, type EphemeralCallKeyPair } from './callCrypto'

export async function waitForEnvelope(
  request: CallRequest,
  callId: string,
  userId: number,
  keyPair: EphemeralCallKeyPair,
  timeoutMs: number,
): Promise<{ key: Uint8Array; generation: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await getE2EEEnvelope(request, callId)
    const envelope = result.envelope
    if (envelope) {
      const keys = await listE2EEPublicKeys(request, callId)
      const sender = keys.find((item) => item.userId === envelope.senderUserId)
      if (sender) {
        const key = await unwrapMediaKey(
          envelope.iv, envelope.ciphertext, keyPair.privateKey, sender.publicKey,
          callId, envelope.senderUserId, userId,
        )
        return { key, generation: envelope.generation }
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 550))
  }
  throw new Error('Không nhận được khóa E2EE từ host. Cuộc gọi không được hạ xuống chế độ kém an toàn.')
}
