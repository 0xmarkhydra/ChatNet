'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')
const { createHash } = require('node:crypto')
const { internalManifest } = require('../scripts/artifact-manifest.cjs')
const pkg = require('../package.json')
const sha = value => createHash('sha256').update(value).digest('hex')

test('distribution commands fail closed without signing and never publish automatically', () => {
  assert.equal(pkg.build.publish, null)
  for (const name of ['dist:mac', 'dist:win']) {
    assert.match(pkg.scripts[name], /--config\.forceCodeSigning=true/)
    assert.match(pkg.scripts[name], /--publish never/)
  }
  assert.match(pkg.scripts['dist:mac'], /--arm64 --x64/)
  assert.match(pkg.scripts['dist:win'], /--x64/)
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false)
  assert.equal(pkg.build.mac.hardenedRuntime, true)
  assert.ok(pkg.build.mac.extendInfo.NSMicrophoneUsageDescription)
  assert.ok(pkg.build.mac.extendInfo.NSCameraUsageDescription)
})

test('installer icon matches the existing SOCO SVG and recorded PNG hash', async () => {
  const root = resolve(__dirname, '..', '..'), asset = join(root, 'desktop/assets')
  const provenance = JSON.parse(await fs.readFile(join(asset, 'icon-provenance.json'), 'utf8'))
  const png = await fs.readFile(join(asset, 'icon.png'))
  assert.equal(sha(await fs.readFile(join(root, 'frontend/public/soco-mark.svg'))), provenance.sourceSha256)
  assert.equal(sha(png), provenance.pngSha256)
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(png.readUInt32BE(16), 1024)
  assert.equal(png.readUInt32BE(20), 1024)
})

test('internal inventory records hashes without claiming signature or release approval', async t => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'soco-manifest-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  await assert.rejects(internalManifest(directory, '0.1.0'), /No internal installers/)
  // Manifest fixture bytes are deliberately not described as a real installer.
  await fs.writeFile(join(directory, 'SOCO-0.1.0-mac-arm64.dmg'), 'manifest-fixture')
  await fs.writeFile(join(directory, 'SOCO-0.0.9-win-x64.exe'), 'old fixture')
  const result = await internalManifest(directory, '0.1.0')
  assert.equal(result.artifacts.length, 1)
  assert.equal(result.artifacts[0].sha256, sha('manifest-fixture'))
  assert.equal(result.artifacts[0].signatureVerified, false)
  assert.equal(result.internalOnly, true)
  assert.equal(result.releaseApproved, false)
  await fs.writeFile(join(directory, 'SOCO-0.1.0-mac-arm64.dmg'), 'changed-fixture')
  assert.notEqual((await internalManifest(directory, '0.1.0')).artifacts[0].sha256, result.artifacts[0].sha256)
  await fs.writeFile(join(directory, 'SOCO-0.1.0-win-arm64.exe'), 'invalid target fixture')
  await assert.rejects(internalManifest(directory, '0.1.0'), /Invalid installer target/)
})
