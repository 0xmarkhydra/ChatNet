import type { ApiRequest } from '../../../shared/types/api'
import type { ReceivedMLSEvent, SignedMLSEvent } from '../lib/mlsTransport'

export async function publishMLSTransportEvent(
  request: ApiRequest,
  conversationId: number,
  envelope: SignedMLSEvent,
): Promise<{ id: number; epoch: number; duplicate?: boolean }> {
  // MLS Commit is a state-changing write. Never auto-retry after a timeout:
  // callers must reconcile by clientId before advancing their local MLS state.
  const response = await request(`/api/conversations/${conversationId}/e2ee/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  if (!response.ok) throw new Error(
    response.status === 409 ? 'Phiên khóa MLS đã thay đổi, cần đồng bộ lại.' :
      'Không thể gửi bản tin MLS đã mã hóa.',
  )
  return response.json()
}

export async function listMLSTransportEvents(
  request: ApiRequest,
  conversationId: number,
  deviceId: string,
  after = 0,
  limit = 25,
): Promise<{ events: ReceivedMLSEvent[]; currentEpoch: number; nextAfter: number }> {
  if (!Number.isSafeInteger(after) || after < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('Invalid MLS event cursor')
  }
  const url = `/api/conversations/${conversationId}/e2ee/events?deviceId=${encodeURIComponent(deviceId)}&after=${after}&limit=${limit}`
  const response = await request(url)
  if (!response.ok) throw new Error('Không thể đồng bộ bản tin MLS.')
  // The returned server metadata is untrusted. MLS clients MUST validate the
  // ciphertext transcript, sender credentials and epoch before applying it.
  return response.json()
}
