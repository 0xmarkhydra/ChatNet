import assert from 'node:assert/strict'
import { loadPrivacy, savePrivacySettings } from '../src/features/settings/api/privacy.ts'
import { syncPushSubscription, requestPushTest } from '../src/features/notifications/api/push.ts'

const calls = []
const request = (path, init) => {
  calls.push({ path, init: init ?? {} })
  return Promise.resolve(new Response(null, { status: 204 }))
}
const controller = new AbortController()
await Promise.all([
  loadPrivacy(request, controller.signal),
  savePrivacySettings(request, { showOnlineStatus: false }),
  syncPushSubscription(request, 'subscriber', true),
  syncPushSubscription(request, 'subscriber', false),
  requestPushTest(request),
])
assert.deepEqual(calls.map(({ path, init }) => [path, init.method ?? 'GET']), [
  ['/api/privacy', 'GET'],
  ['/api/privacy', 'PUT'],
  ['/api/push/subscription', 'POST'],
  ['/api/push/subscription', 'DELETE'],
  ['/api/push/test', 'POST'],
])
assert.equal(calls[0].init.signal, controller.signal)
assert.equal(calls[1].init.headers['Content-Type'], 'application/json')
assert.deepEqual(JSON.parse(calls[1].init.body), { showOnlineStatus: false })
assert.equal(calls[2].init.headers['Content-Type'], 'application/json')
assert.deepEqual(JSON.parse(calls[2].init.body), { subscriptionId: 'subscriber' })
assert.equal(calls[3].init.body, calls[2].init.body)
console.log('PASS: privacy and push API request contracts')
