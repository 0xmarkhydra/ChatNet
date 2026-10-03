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
    requestPermission: async () => {},
    addEventListener: () => {},
  },
  User: {
    PushSubscription: {
      optedIn: false,
      addEventListener: () => {},
    },
  },
}

globalThis.Notification = { permission: 'default' }
globalThis.location = { hostname: 'localhost' }
globalThis.window = {
  setTimeout,
  OneSignalDeferred: [],
}
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({ dataset: {} }),
  head: {
    appendChild: () => {
      queueMicrotask(() => {
        for (const ready of window.OneSignalDeferred) ready(OneSignal)
      })
    },
  },
}

const { setupOneSignal } = await import('../src/onesignal.ts')
const first = setupOneSignal('test-app')
const second = setupOneSignal('test-app')

await new Promise((resolve) => setImmediate(resolve))
assert.equal(initCalls, 1, 'concurrent setup must initialize OneSignal once')
finishInit()
await Promise.all([first, second])
assert.equal(initCalls, 1, 'completed setup must stay initialized')

console.log('PASS: concurrent OneSignal setup initializes SDK once')
