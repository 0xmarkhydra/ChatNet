import assert from 'node:assert/strict'
import { appendUniquePosts, isCurrentFeedRefresh } from '../src/features/feed/utils/feedRequestState.ts'

const post = id => ({ id, content: `post-${id}` })

const existing = [post(9), post(8)]
const nextPage = [post(8), post(7), post(6)]
const combined = appendUniquePosts(existing, nextPage)
assert.deepEqual(combined.map(item => item.id), [9, 8, 7, 6], 'pagination must keep order and remove existing posts')
assert.deepEqual(existing.map(item => item.id), [9, 8], 'pagination must not mutate previous posts')
assert.deepEqual(appendUniquePosts([], [post(4)]).map(item => item.id), [4], 'first page stays intact')
assert.deepEqual(appendUniquePosts(existing, []).map(item => item.id), [9, 8], 'empty page preserves posts')

const request = { sessionId: 'session-a', revision: 4, sequence: 8 }
assert.equal(isCurrentFeedRefresh(request, { ...request }), true, 'latest request should be accepted')
assert.equal(isCurrentFeedRefresh(request, { ...request, sequence: 9 }), false, 'older response must be ignored')
assert.equal(isCurrentFeedRefresh(request, { ...request, revision: 5 }), false, 'response predating a mutation must be ignored')
assert.equal(isCurrentFeedRefresh(request, { ...request, sessionId: 'session-b' }), false, 'response from previous session must be ignored')
assert.equal(isCurrentFeedRefresh(request, { ...request, sessionId: undefined }), false, 'response after logout must be ignored')

console.log('PASS: Feed pagination and stale request guards')
