import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const bad = []
let checked = 0
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) { scan(full); continue }
    if (!/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) continue
    const source = path.relative(root, full).split(path.sep).join('/')
    checked += 1
    if (source.startsWith('features/chat/') &&
        source.slice('features/chat/'.length).indexOf('/') === -1 &&
        source !== 'features/chat/types.ts') {
      bad.push(`${source}: Chat root must only contain types.ts`)
    }
    const text = fs.readFileSync(full, 'utf8')
    const patterns = [
      /\bfrom\s*['"]([^'"]+)['"]/g,
      /\bimport\s*['"]([^'"]+)['"]/g,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ]
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const spec = match[1]
        if (!spec.startsWith('.')) continue
        const target = path.relative(root, path.resolve(path.dirname(full), spec))
          .split(path.sep).join('/')
        if ((source.startsWith('shared/') || source.startsWith('platform/')) &&
            target.startsWith('features/')) {
          bad.push(`${source}: shared/platform must not depend on ${target}`)
        }
        if (source.startsWith('features/') && target.startsWith('app/')) {
          bad.push(`${source}: features must not depend on ${target}`)
        }
      }
    }
  }
}
scan(root)
assert.equal(bad.length, 0, bad.join('\n'))
console.log(`PASS: architecture boundaries in ${checked} source files`)
