import assert from 'node:assert/strict'

let initCalls = 0
let finishInit

const OneSignal = {
  init: () => {
    initCalls += 1
    return new Promise((resolve) => {
      finishInit = resolve
    })
  },
  Notifications: {
    permission: false,
    isPushSupported: () => true,
    requestPermission: async () => {
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
      optIn: async () => {},
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

const { enableOneSignalPush, setupOneSignal } = await import('../src/onesignal.ts')
const first = setupOneSignal('test-app')
const second = setupOneSignal('test-app')

await new Promise((resolve) => setImmediate(resolve))
assert.equal(initCalls, 1, 'concurrent setup must initialize OneSignal once')
finishInit()
await Promise.all([first, second])
assert.equal(initCalls, 1, 'completed setup must stay initialized')

const enabled = await enableOneSignalPush()
assert.equal(enabled.optedIn, true, 'enable must wait for OneSignal opt-in state')
assert.equal(enabled.subscriptionId, 'subscription-id', 'enable must wait for subscription ID')

console.log('PASS: OneSignal initialization and delayed subscription')
