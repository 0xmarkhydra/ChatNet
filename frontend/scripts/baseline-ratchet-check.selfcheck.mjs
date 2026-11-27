import test from 'node:test'
import assert from 'node:assert/strict'
import { addedArchitectureDebt, increasedDesignDebt, increasedLintDebt, increasedI18nDebt } from './baseline-ratchet-check.mjs'

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

test('design-debt baseline permits reductions but rejects increases and new pairs', () => {
  const previous = { totals: { 'css.hex': 3 }, counts: { 'a.css|css.hex': 3 } }
  assert.deepEqual(increasedDesignDebt(previous, { totals: { 'css.hex': 2 }, counts: { 'a.css|css.hex': 2 } }), [])
  assert.deepEqual(increasedDesignDebt(previous, { totals: { 'css.hex': 4 }, counts: { 'a.css|css.hex': 3, 'b.css|css.hex': 1 } }), [
    'total css.hex: 3 -> 4', 'b.css|css.hex: 0 -> 1',
  ])
})

test('i18n baseline allows reductions only', () => {
  assert.deepEqual(increasedI18nDebt({a: 2}, {a: 1}), [])
  assert.deepEqual(increasedI18nDebt({a: 2}, {a: 3, b: 1}), ['a: 2 -> 3', 'b: 0 -> 1'])
})
