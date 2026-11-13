import test from 'node:test'
import assert from 'node:assert/strict'
import { addedArchitectureDebt, increasedLintDebt } from './baseline-ratchet-check.mjs'

test('architecture baseline permits only deletion', () => {
  const previous = { violations: ['cycle:a', 'entry:b'] }
  assert.deepEqual(addedArchitectureDebt(previous, { violations: ['cycle:a'] }), [])
  assert.deepEqual(addedArchitectureDebt(previous, { violations: ['cycle:a', 'new:c'] }), ['new:c'])
})

test('lint baseline permits reductions but never hides new pair findings', () => {
  const previous = { total: 4, counts: { 'A|rule': 3, 'B|rule': 1 } }
  assert.deepEqual(increasedLintDebt(previous, { total: 3, counts: { 'A|rule': 2, 'B|rule': 1 } }), [])
  assert.deepEqual(increasedLintDebt(previous, { total: 4, counts: { 'A|rule': 2, 'C|rule': 2 } }), [
    'C|rule: 0 -> 2',
  ])
  assert.deepEqual(increasedLintDebt(previous, { total: 5, counts: { 'A|rule': 4, 'B|rule': 1 } }), [
    'total: 4 -> 5', 'A|rule: 3 -> 4',
  ])
})
