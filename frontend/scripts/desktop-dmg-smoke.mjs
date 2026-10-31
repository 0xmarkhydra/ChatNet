import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, cp, rm, lstat, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Internal DMG copy/install smoke, not signed Gatekeeper/notarization or customer clean-install acceptance.
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('This smoke requires the connected macOS arm64 host')
const exec = promisify(execFile)
const scripts = dirname(fileURLToPath(import.meta.url)), root = resolve(scripts, '../..')
const output = join(root, 'frontend/output/desktop-smoke')
await mkdir(output, { recursive: true })
const directory = await mkdtemp(join(output, 'dmg-install-'))
const mount = join(directory, 'mounted'), install = join(directory, 'installed')
let mounted = false
try {
  const { version } = JSON.parse(await readFile(join(root, 'desktop/package.json'), 'utf8'))
  assert.match(version, /^[0-9A-Za-z.+-]+$/)
  const dmg = join(root, `desktop/release/SOCO-${version}-mac-arm64.dmg`)
  await exec('hdiutil', ['verify', dmg], { timeout: 60000 })
  await mkdir(mount); await mkdir(install)
  await exec('hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-mountpoint', mount], { timeout: 60000 })
  mounted = true
  const source = join(mount, 'SOCO.app')
  assert.equal((await lstat(source)).isDirectory(), true)
  assert.equal((await lstat(source)).isSymbolicLink(), false)
  const destination = join(install, 'SOCO.app')
  // Copy only the application, never follow the DMG's /Applications convenience link.
  await cp(source, destination, { recursive: true, dereference: false, verbatimSymlinks: true })
  await exec('hdiutil', ['detach', mount], { timeout: 30000 }); mounted = false
  const result = await exec(process.execPath, [join(scripts, 'desktop-shell-smoke.mjs')], {
    cwd: root, env: { ...process.env, SOCO_TEST_EXECUTABLE: join(destination, 'Contents/MacOS/SOCO') },
    timeout: 120000, maxBuffer: 2 * 1024 * 1024,
  })
  await writeFile(join(output, 'dmg-install-smoke.log'), result.stdout + result.stderr)
  console.log('PASS: internal arm64 DMG checksum, read-only mount, isolated application copy, packaged native smoke and temporary uninstall. Signed Gatekeeper/customer install acceptance NOT RUN.')
} finally {
  if (mounted) await exec('hdiutil', ['detach', mount], { timeout: 30000 })
  // Delete only the unique directory created above; no system Applications or normal profile touched.
  await rm(directory, { recursive: true, force: true })
}
