import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { checkTokenContract, findUnapprovedDeclarations } from './design-system-check.mjs'

const root = fileURLToPath(new URL('../src/styles/', import.meta.url))
const theme = readFileSync(join(root, 'soco-theme.css'), 'utf8')
const tailwind = readFileSync(join(root, 'tailwind.css'), 'utf8')

test('the design system tokens have complete Tailwind mappings', () => {
  assert.deepEqual(checkTokenContract(theme, tailwind), [])
})

test('missing mappings fail the token contract', () => {
  assert.ok(checkTokenContract(theme, tailwind.replace('--text-ui-page:', '--text-unknown-page:')).some((error) => error.includes('--text-ui-page')))
})

test('z-index layers and the focus ring must stay tokenised', () => {
  assert.ok(checkTokenContract(theme.replace('--soco-z-modal:', '--soco-z-other:'), tailwind).some((error) => error.includes('--soco-z-modal')))
  assert.ok(checkTokenContract(theme.replace('var(--soco-focus-ring)', 'rgba(37, 99, 235, .42)'), tailwind).some((error) => error.includes('focus ring')))
})

test('the app breakpoint variants must stay defined', () => {
  assert.ok(checkTokenContract(theme, tailwind.replace('app-desktop', 'app-other')).some((error) => error.includes('app-desktop')))
  assert.ok(checkTokenContract(theme, tailwind.replace('app-mobile', 'app-other')).some((error) => error.includes('app-mobile')))
})

test('Tailwind Preflight stays disabled', () => {
  assert.ok(checkTokenContract(theme, tailwind + '\n@import "tailwindcss";').some((error) => error.includes('Preflight')))
})

test('shared UI CSS accepts semantic declarations', () => {
  assert.deepEqual(findUnapprovedDeclarations('.button { color: var(--soco-text); gap: var(--soco-space-2); font-family: var(--soco-font-sans); }'), [])
})

test('shared UI CSS rejects new hardcoded styles', () => {
  const issues = findUnapprovedDeclarations('.card { color: #f00; gap: 17px; font-family: Arial, sans-serif; }')
  assert.equal(issues.length, 3)
  assert.ok(issues.some((issue) => issue.startsWith('hardcoded color:')))
  assert.ok(issues.some((issue) => issue.startsWith('custom font-family:')))
  assert.ok(issues.some((issue) => issue.startsWith('hardcoded typography or spacing:')))
})

test('CSS comments do not cause false positives', () => {
  assert.deepEqual(findUnapprovedDeclarations('/* color: #fff; gap: 13px; */ .box { padding: var(--soco-space-3); }'), [])
})
