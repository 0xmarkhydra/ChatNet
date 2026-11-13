import assert from 'node:assert/strict'
import {
  loadProfileNote, saveProfileNote, deleteProfileNote, loadVisitorProfile,
  loadVisitorPosts, reactToVisitorPost,
} from '../src/features/profile/api/profile.ts'

const calls = []
const request = (path, init) => {
  calls.push({ path, init })
  return Promise.resolve(new Response(null, { status: 204 }))
}
await Promise.all([
  loadProfileNote(request, 'trung', true),
  loadProfileNote(request, 'user name', false, true),
  saveProfileNote(request, 'hello', 'friends'),
  deleteProfileNote(request, 'ver-1'),
  loadVisitorProfile(request, 'a b'),
  loadVisitorProfile(request, 'a b', true),
  loadVisitorPosts(request, 'a b'),
  loadVisitorPosts(request, 'a b', 42),
  loadVisitorPosts(request, 'a b', undefined, true),
  reactToVisitorPost(request, 42, '👍'),
  reactToVisitorPost(request, 42, '❤️'),
])
assert.deepEqual(calls.map(({ path, init }) => [path, init?.method || 'GET', init?.cache || null]), [
  ['/api/profile/note', 'GET', null],
  ['/api/users/user%20name/note', 'GET', 'reload'],
  ['/api/profile/note', 'POST', null],
  ['/api/profile/note', 'DELETE', null],
  ['/api/users/a%20b/profile', 'GET', null],
  ['/api/users/a%20b/profile', 'GET', 'reload'],
  ['/api/posts?author=a%20b&limit=15', 'GET', null],
  ['/api/posts?author=a%20b&limit=15&before=42', 'GET', null],
  ['/api/posts?author=a%20b&limit=15', 'GET', 'reload'],
  ['/api/posts/42/like', 'POST', null],
  ['/api/posts/42/reactions', 'POST', null],
])
assert.deepEqual(JSON.parse(calls[2].init.body), { content: 'hello', visibility: 'friends' })
assert.deepEqual(JSON.parse(calls[3].init.body), { version: 'ver-1' })
assert.equal(calls[9].init.body, undefined)
assert.equal(calls[10].init.headers['Content-Type'], 'application/json')
assert.deepEqual(JSON.parse(calls[10].init.body), { emoji: '❤️' })
console.log('PASS: profile note, visitor profile, timeline and reaction request contracts')
