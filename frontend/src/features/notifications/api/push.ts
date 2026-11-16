export type PushRequest = (path: string, init?: RequestInit) => Promise<Response>

export function syncPushSubscription(request: PushRequest, subscriptionId: string, optedIn: boolean) {
  return request('/api/push/subscription', {
    method: optedIn ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId }),
  })
}

export function requestPushTest(request: PushRequest) {
  return request('/api/push/test', { method: 'POST' })
}
