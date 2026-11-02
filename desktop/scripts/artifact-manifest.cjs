'use strict'

const fs = require('node:fs/promises')
const { createReadStream } = require('node:fs')
const { createHash } = require('node:crypto')
const { join, resolve } = require('node:path')
const { execFileSync } = require('node:child_process')

async function internalManifest(directory, version) {
  const artifacts = []
  for (const name of (await fs.readdir(directory)).sort()) {
    if (!name.startsWith(`SOCO-${version}-`)) continue
    const match = /^SOCO-[0-9A-Za-z.+-]+-(mac|win)-(arm64|x64)\.(dmg|zip|exe)$/.exec(name)
    if (!match) continue
    const [platform, arch, extension] = match.slice(1)
    if (platform === 'win' ? arch !== 'x64' || extension !== 'exe' : extension === 'exe') throw new Error('Invalid installer target')
    const path = join(directory, name), info = await fs.lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || info.size === 0) throw new Error('Invalid installer file')
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    artifacts.push({ name, platform, arch, bytes: info.size, sha256: hash.digest('hex'), signatureVerified: false })
  }
  if (!artifacts.length) throw new Error('No internal installers were found')
  return { schemaVersion: 1, version, internalOnly: true, releaseApproved: false,
    warning: 'Hashes detect changes only. They do not establish signatures, notarization, installer compatibility, update safety or release approval.', artifacts }
}

if (require.main === module) {
  const root = resolve(__dirname, '..', '..'), directory = join(root, 'desktop', 'release')
  const { version } = require('../package.json')
  internalManifest(directory, version).then(async manifest => {
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
    manifest.inventoryCommit = git('rev-parse', 'HEAD')
    manifest.inventoryWorktreeDirty = git('status', '--porcelain', '--untracked-files=normal').length > 0
    manifest.generatedAt = new Date().toISOString()
    // Inventory commit is recorded at hashing time, not claimed as a build attestation.
    await fs.writeFile(join(directory, 'internal-artifacts.json'), JSON.stringify(manifest, null, 2) + '\n')
    console.log(JSON.stringify(manifest, null, 2))
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}
module.exports = { internalManifest }
