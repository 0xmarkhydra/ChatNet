import assert from 'node:assert/strict'
import {
  listFriends, listFriendRequests, listContactMetadata, updateContactMetadata,
  findDirectConversation, updateFriendRelationship, removeAcceptedFriend,
  blockUser, unblockUser, listBlockedUsers, reportUser,
} from '../src/features/contacts/api/contacts.ts'

const recorded = []
const request = (path, init) => {
  recorded.push({ path, init: init ?? null })
  return Promise.resolve(new Response(null, { status: 204 }))
}
await Promise.all([
  listFriends(request),
  listFriendRequests(request),
  listContactMetadata(request),
  updateContactMetadata(request, 8, { nickname: 'N', note: 'Memo', favorite: true }),
  findDirectConversation(request, 'nam 1'),
  updateFriendRelationship(request, 8, 'incoming', false),
  updateFriendRelationship(request, 8, 'outgoing', true),
  updateFriendRelationship(request, 8, 'none', false),
  removeAcceptedFriend(request, 8),
  blockUser(request, 8),
  unblockUser(request, 8),
  listBlockedUsers(request),
  reportUser(request, 8, 'spam', 'description'),
])
const summary = recorded.map(({ path, init }) => [path, init?.method ?? 'GET', init?.cache ?? null])
assert.deepEqual(summary, [
  ['/api/friends', 'GET', 'no-store'],
  ['/api/friends/requests', 'GET', 'no-store'],
  ['/api/contacts', 'GET', 'no-store'],
  ['/api/contacts/8', 'PUT', null],
  ['/api/conversations?type=direct&q=nam%201&limit=100', 'GET', 'no-store'],
  ['/api/friends/8/accept', 'POST', null],
  ['/api/friends/8?direction=outgoing', 'DELETE', null],
  ['/api/friends/8', 'POST', null],
  ['/api/friends/8?direction=accepted', 'DELETE', null],
  ['/api/users/8/block', 'POST', null],
  ['/api/users/8/block', 'DELETE', null],
  ['/api/users/blocked', 'GET', null],
  ['/api/users/8/report', 'POST', null],
])
assert.equal(recorded[3].init.headers['Content-Type'], 'application/json')
assert.deepEqual(JSON.parse(recorded[3].init.body), { nickname: 'N', note: 'Memo', favorite: true })
assert.equal(recorded[12].init.headers['Content-Type'], 'application/json')
assert.deepEqual(JSON.parse(recorded[12].init.body), { reason: 'spam', details: 'description' })
console.log('PASS: Contacts API request path, method, cache, headers and body contract')
