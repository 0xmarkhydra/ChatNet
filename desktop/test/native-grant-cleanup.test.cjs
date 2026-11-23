'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { registerNativeGrantCleanup } = require('../src/native-grant-cleanup.cjs')

test('before-quit resets active native grants and tolerates uninitialized modules', () => {
  const app = new EventEmitter()
  const reset = []
  const grants = Object.fromEntries(['mediaPermissions', 'screenCapture', 'nativeNotifications', 'screenshots']
    .map(name => [name, { reset: () => reset.push(name) }]))

  registerNativeGrantCleanup(app, () => grants)
  app.emit('before-quit')
  assert.deepEqual(reset, Object.keys(grants))

  const earlyApp = new EventEmitter()
  registerNativeGrantCleanup(earlyApp, () => ({}))
  assert.doesNotThrow(() => earlyApp.emit('before-quit'))
})
