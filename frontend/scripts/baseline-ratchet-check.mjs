import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repository = path.resolve(frontend, '..')

export function addedArchitectureDebt(previous, current) {
  const before = new Set(previous.violations)
  return current.violations.filter(item => !before.has(item))
}

export function increasedLintDebt(previous, current) {
  const increases = []
  if (current.total > previous.total) increases.push(`total: ${previous.total} -> ${current.total}`)
  for (const [key, count] of Object.entries(current.counts)) {
    const old = previous.counts[key] ?? 0
    if (count > old) increases.push(`${key}: ${old} -> ${count}`)
  }
  return increases
}

export function increasedDesignDebt(previous, current) {
  const increases = []
  for (const [metric, total] of Object.entries(current.totals)) {
    const old = previous.totals[metric] ?? 0
    if (total > old) increases.push(`total ${metric}: ${old} -> ${total}`)
  }
  for (const [key, count] of Object.entries(current.counts)) {
    const old = previous.counts[key] ?? 0
    if (count > old) increases.push(`${key}: ${old} -> ${count}`)
  }
  return increases
}

export function increasedI18nDebt(previous, current) {
  return Object.entries(current).filter(([key, count]) => count > (previous[key] ?? 0))
    .map(([key, count]) => `${key}: ${previous[key] ?? 0} -> ${count}`)
}

function readBaselineAt(ref, filename) {
  const original = execFileSync('git', ['show', `${ref}:${filename}`], {
    cwd: repository, encoding: 'utf8',
  })
  return JSON.parse(original)
}

function run() {
  const baseRef = process.argv[2]
  assert.ok(baseRef, 'Pass an explicit trusted base Git ref (e.g. origin/main)')
  // Git ref is an argv element, not a shell command. This check also keeps
  // refs limited to ordinary branch/revision names.
  assert.match(baseRef, /^[a-zA-Z0-9_./-]+$/)
  const architecturePath = 'frontend/scripts/architecture-baseline.json'
  const lintPath = 'frontend/lint-baseline.json'
  const architectureAdded = addedArchitectureDebt(
    readBaselineAt(baseRef, architecturePath),
    JSON.parse(fs.readFileSync(path.join(repository, architecturePath), 'utf8')),
  )
  const lintIncreases = increasedLintDebt(
    readBaselineAt(baseRef, lintPath),
    JSON.parse(fs.readFileSync(path.join(repository, lintPath), 'utf8')),
  )
  const designPath = 'frontend/design-debt-baseline.json'
  let designIncreases = []
  try {
    designIncreases = increasedDesignDebt(
      readBaselineAt(baseRef, designPath),
      JSON.parse(fs.readFileSync(path.join(repository, designPath), 'utf8')),
    )
  } catch (error) {
    // The first PR that introduces the baseline has nothing to compare against.
    if (!/exists on disk, but not in|does not exist in|path .* exists/.test(String(error.stderr || error.message))) throw error
  }
  assert.deepEqual(architectureAdded, [], `Architecture baseline must never add violations:\n${architectureAdded.join('\n')}`)
  assert.deepEqual(lintIncreases, [], `Lint baseline must not increase:\n${lintIncreases.join('\n')}`)
  assert.deepEqual(designIncreases, [], `Design-debt baseline must not increase:\n${designIncreases.join('\n')}`)
  const i18nPath = 'frontend/scripts/i18n-hardcode-baseline.json'
  const i18nFile = path.join(repository, i18nPath)
  if (fs.existsSync(i18nFile)) {
    let previous
    try { previous = readBaselineAt(baseRef, i18nPath) }
    catch (error) {
      // Only the introducing PR has no previous i18n baseline.
      if (!/exists on disk, but not in|does not exist in|path .* exists/.test(String(error.stderr || error.message))) throw error
    }
    if (previous) {
      const increases = increasedI18nDebt(previous, JSON.parse(fs.readFileSync(i18nFile, 'utf8')))
      assert.deepEqual(increases, [], `i18n baseline must not increase:\n${increases.join('\n')}`)
    }
  }
  console.log('PASS: architecture, lint, design-debt and i18n baselines only ratchet down')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()