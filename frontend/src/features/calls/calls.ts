export type CallMediaType = 'audio' | 'video'
export type CallStatus = 'ringing' | 'active' | 'ended' | 'cancelled'
export type CallRole = 'host' | 'cohost' | 'participant'

export type CallSession = {
  id: string
  conversationId: number
  createdBy: number
  mediaType: CallMediaType
  status: CallStatus
  createdAt: string
  startedAt?: string
  endedAt?: string
}

export type CallView = CallSession & {
  role: CallRole
  joined: boolean
  incoming: boolean
  canEnd: boolean
  e2eeReady: boolean
  configured: boolean
}

export type CallParticipant = {
  userId: number
  role: CallRole
  invitedAt: string
  joinedAt?: string
  leftAt?: string
  declinedAt?: string
}

export type CallJoinCredentials = {
  callId: string
  serverUrl: string
  token: string
  roomName: string
  participantIdentity: string
  role: CallRole
  e2eeRequired: true
  expiresInSeconds: number
}

export type E2EEPublicJWK = { kty: 'EC'; crv: 'P-256'; x: string; y: string }
export type E2EEPublicKeyRecord = { userId: number; publicKey: E2EEPublicJWK; updatedAt: string }
export type E2EEEnvelope = {
  senderUserId: number
  recipientUserId: number
  generation: string
  iv: string
  ciphertext: string
  updatedAt: string
}

export type CallRealtimeEvent = {
  type: 'call.created' | 'call.updated' | 'call.ended' | 'call.e2ee.key-request' | 'call.e2ee.updated'
  conversationId: number
  callId: string
  call?: CallSession
}

export type CallRequest = (path: string, init?: RequestInit) => Promise<Response>

async function expectJSON<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `Call request failed (${response.status})`
    throw new Error(message)
  }
  return body as T
}

export async function createCall(request: CallRequest, conversationId: number, mediaType: CallMediaType) {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) throw new Error('Invalid conversation')
  return expectJSON<CallSession>(await request('/api/calls', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, mediaType }),
  }))
}

export async function getCall(request: CallRequest, callId: string) {
  return expectJSON<CallSession>(await request(`/api/calls/${encodeURIComponent(callId)}`))
}

export async function getCurrentCalls(request: CallRequest) {
  return expectJSON<CallView[]>(await request('/api/calls/current'))
}

export async function getCallParticipants(request: CallRequest, callId: string) {
  return expectJSON<CallParticipant[]>(await request(`/api/calls/${encodeURIComponent(callId)}/participants`))
}

export async function joinCall(request: CallRequest, callId: string): Promise<CallJoinCredentials> {
  const credentials = await expectJSON<CallJoinCredentials>(await request(`/api/calls/${encodeURIComponent(callId)}/join`, { method: 'POST' }))
  if (!credentials.e2eeRequired) throw new Error('ChatNet refuses calls without mandatory E2EE')
  if (!credentials.serverUrl.startsWith('wss://')) throw new Error('ChatNet refuses insecure call signaling')
  return credentials
}

export async function declineCall(request: CallRequest, callId: string) {
  return expectJSON<CallSession>(await request(`/api/calls/${encodeURIComponent(callId)}/decline`, { method: 'POST' }))
}

export async function leaveCall(request: CallRequest, callId: string) {
  await expectJSON<{ ok: true }>(await request(`/api/calls/${encodeURIComponent(callId)}/leave`, { method: 'POST' }))
}

export async function endCall(request: CallRequest, callId: string) {
  return expectJSON<CallSession>(await request(`/api/calls/${encodeURIComponent(callId)}/end`, { method: 'POST' }))
}

export async function publishE2EEPublicKey(request: CallRequest, callId: string, publicKey: E2EEPublicJWK) {
  await expectJSON<{ ok: true }>(await request(`/api/calls/${encodeURIComponent(callId)}/e2ee/public-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicKey }),
  }))
}

export async function listE2EEPublicKeys(request: CallRequest, callId: string) {
  return expectJSON<E2EEPublicKeyRecord[]>(await request(`/api/calls/${encodeURIComponent(callId)}/e2ee/public-keys`))
}

export async function putE2EEEnvelope(
  request: CallRequest, callId: string,
  envelope: Pick<E2EEEnvelope, 'recipientUserId' | 'generation' | 'iv' | 'ciphertext'>,
) {
  await expectJSON<{ ok: true }>(await request(`/api/calls/${encodeURIComponent(callId)}/e2ee/envelopes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope),
  }))
}

export async function getE2EEEnvelope(request: CallRequest, callId: string) {
  return expectJSON<{ envelope: E2EEEnvelope | null }>(await request(`/api/calls/${encodeURIComponent(callId)}/e2ee/envelope`))
}
