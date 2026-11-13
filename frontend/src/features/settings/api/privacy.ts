export type PrivacyRequest = (path: string, init?: RequestInit) => Promise<Response>

export function loadPrivacy(request: PrivacyRequest, signal: AbortSignal) {
  return request('/api/privacy', { signal })
}

export function savePrivacySettings(request: PrivacyRequest, value: unknown) {
  return request('/api/privacy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
}
