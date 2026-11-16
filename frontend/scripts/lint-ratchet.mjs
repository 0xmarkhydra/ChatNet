// Lint ratchet: existing violations are recorded in lint-baseline.json and may
// only go down. New files or rules with violations, or higher counts, fail.
//
//   npm run lint            compare against the baseline (fails on regression)
//   npm run lint:report     print every ESLint finding (no baseline)
//   npm run lint:baseline   rewrite the baseline after violations were fixed
//
// A refactor that moves code between files changes the per-file counts; run
// lint:baseline and let the reviewer confirm that totals did not increase.
import { ESLint } from 'eslint'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { relative, sep } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const baselineFile = new URL('../lint-baseline.json', import.meta.url)
const update = process.argv.includes('--update')

const eslint = new ESLint({ cwd: root })
const results = await eslint.lintFiles(['src'])

const counts = {}
const parseErrors = []
for (const result of results) {
  const file = relative(root, result.filePath).split(sep).join('/')
  for (const message of result.messages) {
    const unusedDirective = !message.ruleId && message.message.startsWith('Unused eslint-disable directive')
    if (!message.ruleId && !unusedDirective) {
      parseErrors.push(`${file}:${message.line} ${message.message}`)
      continue
    }
    const key = `${file}|${message.ruleId || 'unused-disable-directive'}`
    counts[key] = (counts[key] || 0) + 1
  }
}

const sum = (object) => Object.values(object).reduce((total, value) => total + value, 0)
const byRule = {}
for (const [key, value] of Object.entries(counts)) {
  const rule = key.split('|')[1]
  byRule[rule] = (byRule[rule] || 0) + value
}

if (parseErrors.length) {
  console.error(`Parse/config errors (${parseErrors.length}):`)
  parseErrors.slice(0, 20).forEach((line) => console.error('  ' + line))
  process.exit(1)
}

const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))

if (update) {
  writeFileSync(baselineFile, JSON.stringify({ total: sum(counts), byRule, counts: sorted }, null, 2) + '\n')
  console.log(`Baseline updated: ${sum(counts)} findings in ${Object.keys(counts).length} file/rule pairs.`)
  process.exit(0)
}

if (!existsSync(baselineFile)) {
  console.error('lint-baseline.json is missing. Run: npm run lint:baseline')
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')).counts
const regressions = []
const improved = []
for (const [key, value] of Object.entries(counts)) {
  const before = baseline[key] || 0
  if (value > before) regressions.push(`${key}  ${before} -> ${value}`)
}
for (const [key, before] of Object.entries(baseline)) {
  const value = counts[key] || 0
  if (value < before) improved.push(`${key}  ${before} -> ${value}`)
}

console.log(`Rules of React findings: ${sum(counts)} (baseline ${sum(baseline)})`)
for (const [rule, value] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(value).padStart(4)}  ${rule}`)
}
if (improved.length) {
  console.log(`\n${improved.length} file/rule pair(s) improved. Lock it in with: npm run lint:baseline`)
}
if (regressions.length) {
  console.error(`\nFAIL: ${regressions.length} file/rule pair(s) got worse than the baseline:`)
  regressions.slice(0, 40).forEach((line) => console.error('  ' + line))
  console.error('\nFix the new findings. Run "npm run lint:report" to see them with line numbers.')
  process.exit(1)
}
console.log('\nPASS: no new findings compared to the baseline.')
