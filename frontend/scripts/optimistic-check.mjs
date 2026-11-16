import assert from 'node:assert/strict'
import { mergeById, toggleCount, toggleMessageReactionCount } from '../src/shared/utils/optimistic.ts'

const original = [{ emoji: 'like', count: 2, mine: false }]
assert.deepEqual(toggleCount(original, 'like'), [{ emoji: 'like', count: 3, mine: true }])
assert.equal(original[0].count, 2)
assert.deepEqual(toggleCount(toggleCount(original, 'like'), 'like'), original)
assert.deepEqual(toggleCount([{ emoji: 'like', count: 1, mine: true }], 'like'), [])
assert.deepEqual(toggleCount([], 'heart'), [{ emoji: 'heart', count: 1, mine: true }])
const exclusive = [{ emoji: '👍', count: 2, mine: true }, { emoji: '❤️', count: 3, mine: false }]
assert.deepEqual(toggleMessageReactionCount(exclusive, '❤️'), [
  { emoji: '👍', count: 1, mine: false }, { emoji: '❤️', count: 4, mine: true },
])
assert.deepEqual(toggleMessageReactionCount(exclusive, '👍'), [
  { emoji: '👍', count: 1, mine: false }, { emoji: '❤️', count: 3, mine: false },
])
assert.deepEqual(toggleMessageReactionCount([], '😡'), [{ emoji: '😡', count: 1, mine: true }])
assert.deepEqual(exclusive[0], { emoji: '👍', count: 2, mine: true })
const message = { id: 1, text: 'server' }
assert.deepEqual(mergeById(mergeById([], message), message), [message])
assert.deepEqual(mergeById([message], { ...message, text: 'edited' }), [{ id: 1, text: 'edited' }])
console.log('Optimistic checks passed: toggle, rollback, zero count, immutable input, duplicate receipts.')
