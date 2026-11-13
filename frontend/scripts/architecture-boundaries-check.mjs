import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultRoot = path.resolve(here, '../src')
const defaultBaseline = path.join(here, 'architecture-baseline.json')
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css']
const imports = [
  /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]
const slash = value => value.split(path.sep).join('/')

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx|js|jsx|mjs|css)$/.test(entry.name) ? [full] : []
  })
}

function resolveImport(file, spec, root) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null
  const target = spec.startsWith('@/')
    ? path.resolve(root, spec.slice(2))
    : path.resolve(path.dirname(file), spec)
  if (!target.startsWith(root + path.sep)) return null
  const candidates = [target, ...extensions.map(ext => target + ext),
    ...extensions.map(ext => path.join(target, 'index' + ext))]
  const found = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  return found ? slash(path.relative(root, found)) : null
}

function owner(file) {
  const match = /^features\/([^/]+)\//.exec(file)
  return match?.[1] ?? null
}

function dependencies(file, root) {
  const body = fs.readFileSync(file, 'utf8')
  const results = new Set()
  for (const pattern of imports) {
    for (const match of body.matchAll(pattern)) {
      const target = resolveImport(file, match[1], root)
      if (target) results.add(target)
    }
  }
  return [...results].sort()
}

function cycles(edges) {
  const state = new Map()
  const stack = []
  const result = []
  function visit(node) {
    state.set(node, 1)
    stack.push(node)
    for (const next of edges.get(node) ?? []) {
      if (!edges.has(next)) continue
      if (!state.has(next)) visit(next)
      else if (state.get(next) === 1) {
        const cycle = stack.slice(stack.indexOf(next))
        if (cycle.length > 1 || next === node) {
          const rotated = cycle.map((_, i) => [...cycle.slice(i), ...cycle.slice(0, i)])
            .sort((a, b) => a.join('|').localeCompare(b.join('|')))[0]
          result.push([...rotated, rotated[0]].join(' -> '))
        }
      }
    }
    stack.pop()
    state.set(node, 2)
  }
  for (const key of [...edges.keys()].sort()) if (!state.has(key)) visit(key)
  return [...new Set(result)].sort()
}

export function collectViolations(root = defaultRoot) {
  const violations = new Set()
  const edges = new Map()
  const files = sourceFiles(root).sort()
  for (const full of files) {
    const source = slash(path.relative(root, full))
    const targets = dependencies(full, root)
    edges.set(source, targets)
    if (source.startsWith('features/chat/') &&
      source.slice('features/chat/'.length).indexOf('/') === -1 &&
      source !== 'features/chat/types.ts') {
      violations.add(`chat-root: ${source}`)
    }
    for (const target of targets) {
      const srcOwner = owner(source)
      const dstOwner = owner(target)
      if (/^(shared|platform)\//.test(source) && dstOwner) {
        violations.add(`reverse-import: ${source} -> ${target}`)
      }
      if (srcOwner && target.startsWith('app/')) {
        violations.add(`reverse-import: ${source} -> ${target}`)
      }
      if (srcOwner && dstOwner && srcOwner !== dstOwner) {
        if (target.startsWith(`features/${dstOwner}/api/`)) {
          violations.add(`api-ownership: ${source} -> ${target}`)
        } else if (target !== `features/${dstOwner}/index.ts` &&
          target !== `features/${dstOwner}/index.tsx`) {
          violations.add(`feature-entrypoint: ${source} -> ${target}`)
        }
      }
      if (srcOwner && source.includes('/api/') && dstOwner && srcOwner !== dstOwner) {
        violations.add(`api-ownership: ${source} -> ${target}`)
      }
    }
  }
  // Cycles across feature modules are the architectural boundary; internal cycles
  // are reported too so newly introduced coupling cannot hide within a feature.
  for (const cycle of cycles(edges)) violations.add(`dependency-cycle: ${cycle}`)
  return { files: files.length, violations: [...violations].sort() }
}

export function compareBaseline(current, baseline) {
  const existing = new Set(baseline)
  return current.filter(item => !existing.has(item))
}

function run() {
  const root = process.env.ARCHITECTURE_SRC_ROOT
    ? path.resolve(process.env.ARCHITECTURE_SRC_ROOT) : defaultRoot
  const baselineFile = process.env.ARCHITECTURE_BASELINE
    ? path.resolve(process.env.ARCHITECTURE_BASELINE) : defaultBaseline
  const { files, violations } = collectViolations(root)
  if (process.argv.includes('--report')) {
    console.log(violations.join('\n') || '(none)')
    console.log(`Found ${violations.length} violations in ${files} files`)
    return
  }
  if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(baselineFile, JSON.stringify({ violations }, null, 2) + '\n')
    console.log(`Recorded ${violations.length} legacy violations`)
    return
  }
  assert.ok(fs.existsSync(baselineFile), `Missing architecture baseline: ${baselineFile}`)
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).violations
  assert.ok(Array.isArray(baseline), 'Architecture baseline must contain violations array')
  const newViolations = compareBaseline(violations, baseline)
  assert.equal(newViolations.length, 0,
    `New architecture violations (legacy baseline ${baseline.length}):\n${newViolations.join('\n')}`)
  console.log(`PASS: architecture boundaries in ${files} files (${violations.length} legacy, ${baseline.length} baseline)`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()
