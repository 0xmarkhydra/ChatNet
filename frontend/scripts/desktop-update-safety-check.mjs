import assert from 'node:assert/strict'
import { hasPendingDesktopWork, setDesktopCallInProgress } from '../src/platform/desktopUpdateSafety.ts'

function store(entries = {}) {
  const data = new Map(Object.entries(entries))
  return {
    get length() { return data.size },
    key(index) { return [...data.keys()][index] ?? null },
    getItem(key) { return data.get(key) ?? null },
  }
}
assert.equal(hasPendingDesktopWork(store()), false)
assert.equal(hasPendingDesktopWork(store({ 'chatnet:drafts:v1:1': '{"1":{"text":"hello"}}' })), false)
assert.equal(hasPendingDesktopWork(store({ 'chatnet:outbox:v2:1:msg-1': '{"status":"unconfirmed"}' })), true)
assert.equal(hasPendingDesktopWork(store({ 'chatnet:pending-send:v1:2': '{"clientId":"msg-1"}' })), true)
assert.equal(hasPendingDesktopWork(store({ 'chatnet:outbox:v2:3:msg-1': '' })), true)
setDesktopCallInProgress(true)
assert.equal(hasPendingDesktopWork(store()), true)
setDesktopCallInProgress(false)
assert.equal(hasPendingDesktopWork(store()), false)
const denied = { get length() { throw new Error('denied') }, key() { return null }, getItem() { return null } }
assert.equal(hasPendingDesktopWork(denied), true)
console.log('PASS: Desktop update prevents restart with calls/pending sends and preserves drafts')
