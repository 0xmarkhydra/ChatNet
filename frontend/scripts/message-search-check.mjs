import assert from 'node:assert/strict'
import { chatMessageSearchQuery, matchesChatMessageSearch } from '../src/chat-message-filter.ts'

const messages = [
  { sender: 'An', text: 'Xin chào, hôm nay đi họp nhé', createdAt: '2026-10-28T09:00:00' },
  { sender: 'Binh', text: 'Xin chào An', createdAt: '2026-10-28T10:00:00' },
  { sender: 'An', text: 'Tài liệu đã gửi', createdAt: '2026-10-27T10:00:00' },
  { sender: 'Anh', text: 'Xin chào', createdAt: '2026-10-28T11:00:00' },
]
const base = { keyword: '', sender: '', from: '', to: '' }
const select = (filters) => messages.filter((message) => matchesChatMessageSearch(message, { ...base, ...filters }))

assert.deepEqual(select({ keyword: 'xin CHÀO' }).map((item) => item.sender), ['An', 'Binh', 'Anh'])
assert.deepEqual(select({ sender: 'An' }).map((item) => item.text), ['Xin chào, hôm nay đi họp nhé', 'Tài liệu đã gửi'])
assert.deepEqual(select({ sender: '@AN', keyword: 'xin chào' }).map((item) => item.text), ['Xin chào, hôm nay đi họp nhé'])
assert.deepEqual(select({ sender: 'An', keyword: 'không có' }), [])
assert.deepEqual(select({ keyword: 'tài liệu', sender: 'Binh' }), [])
assert.deepEqual(select({ from: '2026-10-28', to: '2026-10-28' }).map((item) => item.sender), ['An', 'Binh', 'Anh'])
assert.deepEqual(select({ sender: 'An', from: '2026-10-28', to: '2026-10-28' }).map((item) => item.text), ['Xin chào, hôm nay đi họp nhé'])
assert.equal(matchesChatMessageSearch({ ...messages[0], deleted: true }, { ...base, keyword: 'xin chào' }), false)
assert.equal(matchesChatMessageSearch({ ...messages[0], text: 'khác' }, { ...base, keyword: 'xin chào' }), false)
const query = new URLSearchParams(chatMessageSearchQuery({ keyword: '  xin chào  ', sender: '@An', from: '2026-10-27', to: '2026-10-28' }))
assert.equal(query.get('search'), 'xin chào')
assert.equal(query.get('sender'), 'An')
assert.equal(query.get('from'), '2026-10-27')
assert.equal(query.get('to'), '2026-10-28')
console.log('PASS: keyword-only, sender-only, combined filters, exact sender, dates, deleted messages and API query.')
