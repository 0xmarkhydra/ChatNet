// Locks the exact requests the Chat API modules send to the backend
// (path, method, headers, body, abort signal), so refactors cannot change the contract.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const load = async (relativePath) => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm',
  })
  return import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
}
const messages = await load('../src/features/chat/api/messages.ts')
const pins = await load('../src/features/chat/api/pins.ts')
const conversations = await load('../src/features/chat/api/conversations.ts')
const groups = await load('../src/features/chat/api/groups.ts')
const categories = await load('../src/features/chat/api/categories.ts')
const media = await load('../src/features/chat/api/media.ts')
const translation = await load('../src/features/chat/api/translation.ts')

const calls = []
const request = async (path, init) => { calls.push({ path, init }); return new Response('{}') }
const last = () => calls[calls.length - 1]
const JSON_HEADERS = { 'Content-Type': 'application/json' }
const expect = (path, init) => assert.deepEqual({ path: last().path, init: last().init }, { path, init })

// ---- messages
await messages.sendMessage(request, { conversationId: 5, text: 'hi', attachments: [], clientId: 'c1' })
expect('/api/conversations/5/messages', { method: 'POST', headers: JSON_HEADERS, body: '{"text":"hi","attachments":[],"clientId":"c1"}' })
await messages.sendMessage(request, { conversationId: 5, text: 'hi', attachments: [], clientId: 'c1', channelId: 3, replyToMessageId: 9 })
assert.equal(last().init.body, '{"text":"hi","attachments":[],"clientId":"c1","channelId":3,"replyToMessageId":9}')
await messages.sendMessage(request, { conversationId: 5, text: 'hi', attachments: [], clientId: 'c1', channelId: 0, replyToMessageId: 0 })
assert.equal(last().init.body, '{"text":"hi","attachments":[],"clientId":"c1"}', 'falsy channel/reply ids are omitted')

await messages.editMessage(request, 7, 'edited')
expect('/api/messages/7', { method: 'PATCH', headers: JSON_HEADERS, body: '{"text":"edited"}' })
await messages.recallMessage(request, 7)
expect('/api/messages/7', { method: 'DELETE' })
await messages.reactToMessage(request, 7, '❤️')
expect('/api/messages/7/reactions', { method: 'POST', headers: JSON_HEADERS, body: '{"emoji":"❤️"}' })

await messages.listMessages(request, { conversationId: 5, target: 'vi', channelId: 2, limit: 30 })
expect('/api/conversations/5/messages?target=vi&channelId=2&limit=30', undefined)
await messages.listMessages(request, { conversationId: 5, target: 'zh-CN', channelId: 2, limit: 80, before: 99 })
expect('/api/conversations/5/messages?target=zh-CN&channelId=2&limit=80&before=99', undefined)
await messages.listMessages(request, { conversationId: 5, target: 'a b', channelId: 2, limit: 30, before: undefined })
assert.equal(last().path, '/api/conversations/5/messages?target=a%20b&channelId=2&limit=30', 'target is URI-encoded')

await messages.markConversationRead(request, 5)
expect('/api/conversations/5/read', { method: 'POST' })
await messages.markChannelRead(request, 5, 2)
expect('/api/conversations/5/channel-read', { method: 'POST', headers: JSON_HEADERS, body: '{"channelId":2}' })

// ---- pins
await pins.listPins(request, 5)
expect('/api/conversations/5/pins', { cache: 'reload' })
await pins.setMessagePinned(request, 7, true)
expect('/api/messages/7/pin', { method: 'PUT' })
await pins.setMessagePinned(request, 7, false)
expect('/api/messages/7/pin', { method: 'DELETE' })
await pins.setConversationPinned(request, 5, true)
expect('/api/conversations/5/pin', { method: 'PUT' })
await pins.setConversationPinned(request, 5, false)
expect('/api/conversations/5/pin', { method: 'DELETE' })

// ---- conversations
await conversations.listConversations(request, 30)
expect('/api/conversations?limit=30', undefined)
await conversations.listConversations(request, 30, 60)
expect('/api/conversations?limit=30&offset=60', undefined)
await conversations.listConversations(request, 30, 0)
expect('/api/conversations?limit=30&offset=0', undefined)
await conversations.listConversationsByCategory(request, { limit: 30, category: 4, offset: 0, force: false })
expect('/api/conversations?limit=30&category=4&offset=0', {})
await conversations.listConversationsByCategory(request, { limit: 30, category: 4, offset: 30, force: true })
expect('/api/conversations?limit=30&category=4&offset=30', { cache: 'reload' })
const signal = new AbortController().signal
await conversations.findConversation(request, 5, signal)
expect('/api/conversations?limit=1&id=5', { cache: 'no-store', signal })
await conversations.listMembershipIds(request, 12)
expect('/api/conversations/memberships?limit=500&after=12', undefined)
await conversations.getUnreadSummary(request, signal)
expect('/api/conversations/unread', { cache: 'no-store', signal })
await conversations.createDirectConversation(request, 'bob')
expect('/api/conversations/direct', { method: 'POST', headers: JSON_HEADERS, body: '{"username":"bob"}' })
await conversations.createGroupConversation(request, { name: 'G', usernames: ['a', 'b'] })
expect('/api/conversations/groups', { method: 'POST', headers: JSON_HEADERS, body: '{"name":"G","usernames":["a","b"]}' })
await conversations.createGroupConversation(request, { name: 'G', usernames: [], topic: 't', isPublic: true })
assert.equal(last().init.body, '{"name":"G","usernames":[],"topic":"t","isPublic":true}', 'community extras follow name and usernames')
await conversations.clearConversationHistory(request, 5)
expect('/api/conversations/5/history', { method: 'DELETE' })
await conversations.createGroupChannel(request, 5, { name: 'ch', description: 'd' })
expect('/api/conversations/5/channels', { method: 'POST', headers: JSON_HEADERS, body: '{"name":"ch","description":"d"}' })

// ---- groups
await groups.getGroupSettings(request, 5)
expect('/api/conversations/5/group-settings', undefined)
await groups.listGroupMembers(request, 5)
expect('/api/conversations/5/members', undefined)
await groups.addGroupMembers(request, 5, ['a'])
expect('/api/conversations/5/members', { method: 'POST', headers: JSON_HEADERS, body: '{"usernames":["a"]}' })
await groups.setGroupMemberRole(request, 5, 8, 'admin')
expect('/api/conversations/5/members/8', { method: 'PATCH', headers: JSON_HEADERS, body: '{"role":"admin"}' })
await groups.removeGroupMember(request, 5, 8)
expect('/api/conversations/5/members/8', { method: 'DELETE' })

// ---- categories (these requests intentionally carry no JSON Content-Type header)
await categories.listCategories(request, false)
expect('/api/conversation-categories', {})
await categories.listCategories(request, true)
expect('/api/conversation-categories', { cache: 'reload' })
await categories.saveCategory(request, { name: 'Work', color: '#fff' })
expect('/api/conversation-categories', { method: 'POST', body: '{"name":"Work","color":"#fff"}' })
await categories.saveCategory(request, { name: 'Work', color: '#fff' }, 3)
expect('/api/conversation-categories/3', { method: 'PUT', body: '{"name":"Work","color":"#fff"}' })
await categories.deleteCategory(request, 3)
expect('/api/conversation-categories/3', { method: 'DELETE' })
await categories.assignCategory(request, 5, 3)
expect('/api/conversations/5/category', { method: 'PUT', body: '{"categoryId":3}' })
await categories.assignCategory(request, 5, null)
assert.equal(last().init.body, '{"categoryId":null}')

// ---- media
await media.presignUpload(request, { scope: 'chat', name: 'a.png', sizeBytes: 10, contentType: 'image/png' }, signal)
expect('/api/media/presign', { method: 'POST', headers: JSON_HEADERS, body: '{"scope":"chat","name":"a.png","sizeBytes":10,"contentType":"image/png"}', signal })
const blob = new Blob(['x'])
await media.relayUpload(request, { storageRef: 'a/b c', relayToken: 'tok', contentType: 'image/png', body: blob }, signal)
expect('/api/media/relay?ref=a%2Fb%20c', { method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-ChatNet-Relay-Token': 'tok' }, body: blob, signal })

// ---- translation / preferences
await translation.savePreferences(request, { targetLanguage: 'en', autoTranslate: true, appLocale: 'vi' })
expect('/api/preferences', { method: 'PUT', headers: JSON_HEADERS, body: '{"targetLanguage":"en","autoTranslate":true,"appLocale":"vi"}' })
await translation.translateText(request, { text: 'xin chào', target: 'en' })
expect('/api/translate', { method: 'POST', headers: JSON_HEADERS, body: '{"text":"xin chào","target":"en"}' })
await translation.translateText(request, { text: 'xin chào', target: 'en', messageId: 7 })
assert.equal(last().init.body, '{"text":"xin chào","target":"en","messageId":7}')

console.log('PASS: chat API requests (paths, methods, headers, bodies, signals) are unchanged')
