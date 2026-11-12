// Locks the exact requests the Feed API modules send to the backend
// (path, method, headers, body), so refactors cannot change the contract.
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
const posts = await load('../src/features/feed/api/posts.ts')
const comments = await load('../src/features/feed/api/comments.ts')
const types = await load('../src/features/feed/types.ts')

const calls = []
const request = async (path, init) => { calls.push({ path, init }); return new Response('{}') }
const last = () => calls[calls.length - 1]
const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ---- posts
await posts.listMyPosts(request, { before: 0, force: false })
assert.deepEqual(last(), { path: `/api/posts?scope=mine&limit=${types.FEED_PAGE_SIZE}`, init: {} })
await posts.listMyPosts(request, { before: 42, force: true })
assert.deepEqual(last(), { path: `/api/posts?scope=mine&limit=${types.FEED_PAGE_SIZE}&before=42`, init: { cache: 'reload' } })

await posts.submitPost(request, { content: 'hello', attachments: [], visibility: 'friends', background: 'bg-1' })
assert.equal(last().path, '/api/posts')
assert.equal(last().init.method, 'POST')
assert.deepEqual(last().init.headers, JSON_HEADERS)
assert.equal(last().init.body, '{"content":"hello","attachments":[],"visibility":"friends","background":"bg-1"}')

await posts.patchPost(request, 7, { content: 'edited', visibility: 'private', background: '' })
assert.equal(last().path, '/api/posts/7')
assert.equal(last().init.method, 'PATCH')
assert.deepEqual(last().init.headers, JSON_HEADERS)
assert.equal(last().init.body, '{"content":"edited","visibility":"private","background":""}')

await posts.reactToPost(request, 7, '👍')
assert.deepEqual(last(), { path: '/api/posts/7/like', init: { method: 'POST' } })
await posts.reactToPost(request, 7, '❤️')
assert.equal(last().path, '/api/posts/7/reactions')
assert.equal(last().init.method, 'POST')
assert.deepEqual(last().init.headers, JSON_HEADERS)
assert.equal(last().init.body, '{"emoji":"❤️"}')

// ---- comments
await comments.submitComment(request, 7, 'hi')
assert.equal(last().path, '/api/posts/7/comments')
assert.equal(last().init.method, 'POST')
assert.deepEqual(last().init.headers, JSON_HEADERS)
assert.equal(last().init.body, '{"content":"hi"}', 'An undefined parentId must be omitted')
await comments.submitComment(request, 7, 'reply', 3)
assert.equal(last().init.body, '{"content":"reply","parentId":3}')

await comments.changeComment(request, 7, 9, 'PATCH', 'fixed')
assert.equal(last().path, '/api/posts/7/comments/9')
assert.equal(last().init.method, 'PATCH')
assert.deepEqual(last().init.headers, JSON_HEADERS)
assert.equal(last().init.body, '{"content":"fixed"}')
await comments.changeComment(request, 7, 9, 'DELETE')
assert.deepEqual(last(), { path: '/api/posts/7/comments/9', init: { method: 'DELETE' } })

await comments.reportComment(request, 9, 'spam')
assert.equal(last().path, '/api/feed/reports')
assert.equal(last().init.method, 'POST')
assert.deepEqual(last().init.headers, JSON_HEADERS)
assert.equal(last().init.body, '{"targetType":"comment","targetId":9,"reason":"spam"}')

console.log('PASS: feed API requests (paths, methods, headers and bodies) are unchanged')
