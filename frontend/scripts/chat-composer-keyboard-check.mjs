import assert from 'node:assert/strict'
import { shouldSendChatOnEnter } from '../src/features/chat/composerKeyboard.ts'

const enter = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false }
assert.equal(shouldSendChatOnEnter(enter), true, 'Enter sends the message')
assert.equal(shouldSendChatOnEnter({ ...enter, shiftKey: true }), false, 'Shift+Enter inserts a newline')
assert.equal(shouldSendChatOnEnter({ ...enter, ctrlKey: true }), false)
assert.equal(shouldSendChatOnEnter({ ...enter, metaKey: true }), false)
assert.equal(shouldSendChatOnEnter({ ...enter, altKey: true }), false)
assert.equal(shouldSendChatOnEnter({ ...enter, isComposing: true }), false, 'IME confirmation must not send')
assert.equal(shouldSendChatOnEnter({ ...enter, key: 'a' }), false)
console.log('Chat composer keyboard shortcuts: PASS')
