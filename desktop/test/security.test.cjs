'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { trustedRendererURL, safeExternalURL, isSafeAssetPath } = require('../src/ipc-policy.cjs')
const { resolve } = require('node:path')

test('IPC sender rejects arbitrary origins and dev/prod origin swapping', () => {
  assert.equal(trustedRendererURL('app://soco/index.html'), true)
  assert.equal(trustedRendererURL('http://127.0.0.1:5173/', true), true)
  for (const url of [
    'https://chat.codelocal.cloud/', 'https://evil.example/', 'file:///etc/passwd',
    'app://evil/index.html', 'app://soco.evil.example/', 'javascript:alert(1)',
  ]) assert.equal(trustedRendererURL(url), false, url)
  assert.equal(trustedRendererURL('http://127.0.0.1:5173/'), false)
  assert.equal(trustedRendererURL('app://soco/index.html', true), false)
})

test('links reject unsafe schemes, hosts, credentials and ports', () => {
  assert.equal(safeExternalURL('https://chat.codelocal.cloud/help'), 'https://chat.codelocal.cloud/help')
  for (const url of [
    'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,test',
    'https://chat.codelocal.cloud.evil.example/', 'https://evil.example',
    'https://user:pass@chat.codelocal.cloud/', 'https://chat.codelocal.cloud:444/',
  ]) assert.equal(safeExternalURL(url), null, url)
})

test('bundled static paths cannot escape renderer root', () => {
  const root = resolve('/tmp/soco/renderer')
  assert.equal(isSafeAssetPath(root, '/assets/index.js'), resolve(root, 'assets/index.js'))
  assert.equal(isSafeAssetPath(root, '/../../private'), null)
  assert.equal(isSafeAssetPath(root, '/%2e%2e/%2e%2e/private'), null)
  assert.equal(isSafeAssetPath(root, '/%5cprivate'), null)
  assert.equal(isSafeAssetPath(root, '/%00'), null)
})
