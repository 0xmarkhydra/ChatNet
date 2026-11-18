// Vendor the audited upstream UI UX Pro Max skill without running an installer.
// Usage: node scripts/vendor-ui-ux-pro-max.mjs <checked-out-upstream-skill-dir> [--verify]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strict as assert } from 'node:assert'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.argv[2] || '')
const verificationOnly = process.argv.includes('--verify')
assert.ok(process.argv[2], 'Supply the vetted upstream .claude/skills/ui-ux-pro-max directory')
assert.ok(relative(projectRoot, source) && !relative(projectRoot, source).startsWith('..' + sep) && relative(projectRoot, source) !== '..', 'Source must be within this isolated worktree')
assert.equal(source.split(sep).at(-1), 'ui-ux-pro-max', 'Unexpected upstream skill directory')
assert.ok(existsSync(join(source, 'SKILL.md')), 'Missing original SKILL.md')
assert.ok(existsSync(join(source, 'scripts', 'search.py')), 'Missing upstream search.py')
const license = resolve(source, '..', '..', '..', 'LICENSE')
assert.ok(existsSync(license), 'Upstream MIT license must be present')

function filePaths(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? filePaths(join(dir, entry.name), join(prefix, entry.name)) : [join(prefix, entry.name)])
    .sort()
}
const sourcePaths = filePaths(source)
function verify(dest) {
  assert.ok(existsSync(dest), 'Missing skill installation: ' + dest)
  const destPaths = filePaths(dest).filter(path => path !== 'LICENSE')
  assert.deepEqual(destPaths, sourcePaths, 'Upstream skill content differs: ' + dest)
  for (const path of sourcePaths)
    assert.deepEqual(readFileSync(join(dest, path)), readFileSync(join(source, path)), 'Modified upstream file: ' + path)
  assert.deepEqual(readFileSync(join(dest, 'LICENSE')), readFileSync(license), 'MIT license mismatch')
}
for (const agent of ['.agents', '.claude']) {
  const dest = join(projectRoot, agent, 'skills', 'ui-ux-pro-max')
  if (!verificationOnly && !existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(source, dest, { recursive: true, force: false, errorOnExist: true })
    cpSync(license, join(dest, 'LICENSE'), { force: false, errorOnExist: true })
  }
  verify(dest)
  console.log('PASS: ' + agent + '/skills/ui-ux-pro-max matches upstream + MIT license (' + sourcePaths.length + ' files)')
}
console.log(verificationOnly ? 'PASS: verified existing skill mirrors' : 'PASS: skill install/verification complete')
