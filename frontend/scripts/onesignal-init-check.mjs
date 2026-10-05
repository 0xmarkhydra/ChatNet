import assert from 'node:assert/strict'

let initCalls = 0
let finishInit
let initOptions
let permissionCalls = 0
let optInCalls = 0
const storage = new Map()

const OneSignal = {
  init: (options) => {
    initCalls += 1
    initOptions = options
    return new Promise((resolve) => {
      finishInit = resolve
    })
  },
  Notifications: {
    permission: false,
    isPushSupported: () => true,
    requestPermission: async () => {
      permissionCalls += 1
      Notification.permission = 'granted'
      setTimeout(() => {
        OneSignal.User.PushSubscription.optedIn = true
        OneSignal.User.PushSubscription.id = 'subscription-id'
      }, 20)
    },
    addEventListener: () => {},
  },
  User: {
    PushSubscription: {
      optedIn: false,
      optIn: async () => {
        optInCalls += 1
        assert.equal(Notification.permission, 'granted', 'request consent before subscribing')
        setTimeout(() => {
          OneSignal.User.PushSubscription.optedIn = true
          OneSignal.User.PushSubscription.id = 'subscription-id'
        }, 20)
      },
      optOut: async () => {
        OneSignal.User.PushSubscription.optedIn = false
      },
      addEventListener: () => {},
    },
  },
}

globalThis.Notification = { permission: 'default' }
globalThis.location = { hostname: 'localhost' }
globalThis.window = {
  Notification,
  setTimeout,
  clearTimeout,
  OneSignalDeferred: [],
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
}
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({
    dataset: {},
    addEventListener(name, handler) {
      if (name === 'error') this.onerror = handler
    },
    remove() {},
  }),
  head: {
    appendChild: () => {
      queueMicrotask(() => {
        for (const ready of window.OneSignalDeferred) ready(OneSignal)
      })
    },
  },
}

const { disableOneSignalPush, enableOneSignalPush, isPushDisabled, setupOneSignal } = await import('../src/onesignal.ts')
const first = setupOneSignal('test-app')
const second = setupOneSignal('test-app')

await new Promise((resolve) => setImmediate(resolve))
assert.equal(initCalls, 1, 'concurrent setup must initialize OneSignal once')
finishInit()
await Promise.all([first, second])
assert.equal(initCalls, 1, 'completed setup must stay initialized')
assert.equal(permissionCalls, 0, 'entry must not request permission without a user gesture')
assert.equal(optInCalls, 0, 'entry with default permission must not subscribe')
assert.equal(
  initOptions.serviceWorkerOverrideForTypical,
  true,
  'typical web apps must honor the custom service worker path',
)

const enabled = await enableOneSignalPush()
assert.equal(enabled.optedIn, true, 'enable must wait for OneSignal opt-in state')
assert.equal(enabled.subscriptionId, 'subscription-id', 'enable must wait for subscription ID')
assert.equal(permissionCalls, 1, 'one click must request permission only once')

await disableOneSignalPush()
assert.equal(isPushDisabled(), true, 'explicit opt-out must be remembered')
assert.equal(storage.get('chatnet-push-disabled'), 'true', 'opt-out must persist across visits')
const callsAfterDisable = optInCalls
await setupOneSignal('test-app')
assert.equal(optInCalls, callsAfterDisable, 'entry must respect existing opt-out')
OneSignal.User.PushSubscription.id = undefined
await setupOneSignal('test-app')
assert.equal(optInCalls, callsAfterDisable, 'entry must respect opt-out even without subscription ID')

await enableOneSignalPush()
assert.equal(isPushDisabled(), false, 'explicit enable must clear opt-out')
assert.equal(permissionCalls, 1, 'granted permission must not prompt again')
OneSignal.User.PushSubscription.optedIn = false
OneSignal.User.PushSubscription.id = undefined
const automatic = await setupOneSignal('test-app')
assert.equal(automatic.optedIn, true, 'entry must connect automatically when permission was granted')
assert.equal(automatic.subscriptionId, 'subscription-id')
assert.equal(permissionCalls, 1, 'automatic connection must not request permission')

OneSignal.User.PushSubscription.optedIn = false
const callsBeforeLegacy = optInCalls
await setupOneSignal('test-app')
assert.equal(optInCalls, callsBeforeLegacy, 'legacy SDK opt-out must remain off')

Notification.permission = 'denied'
await setupOneSignal('test-app')
await enableOneSignalPush()
assert.equal(permissionCalls, 1, 'denied permission must not prompt again')
assert.equal(optInCalls, callsBeforeLegacy, 'denied permission must not subscribe')

Notification.permission = 'default'
OneSignal.Notifications.requestPermission = async () => { permissionCalls += 1 }
const dismissed = await enableOneSignalPush()
assert.equal(dismissed.optedIn, false, 'dismissing native prompt must keep notifications off')
assert.equal(optInCalls, callsBeforeLegacy)
OneSignal.Notifications.isPushSupported = () => false
await setupOneSignal('test-app')
await enableOneSignalPush()
assert.equal(permissionCalls, 2, 'unsupported browsers must not request permission')
assert.equal(optInCalls, callsBeforeLegacy)

const failedInitCalls = initCalls
OneSignal.init = async () => {
  initCalls += 1
  throw new Error('first init failed')
}
const failedModule = await import('../src/onesignal.ts?failed-init')
await assert.rejects(failedModule.setupOneSignal('test-app'), /first init failed/)
await assert.rejects(failedModule.setupOneSignal('test-app'), /first init failed/)
assert.equal(initCalls, failedInitCalls + 1, 'failed init must not be retried in the same page')

console.log('PASS: OneSignal initialization, consent, automatic connection, opt-out and delayed subscription')
