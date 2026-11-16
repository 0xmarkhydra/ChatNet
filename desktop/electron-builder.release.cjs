'use strict'

// A public GitHub Release is the update feed; no extra server or runtime token.
// Development/unsigned QA builds still use package.json's publish:null.
const build = require('./package.json').build
module.exports = {
  ...build,
  publish: [{
    provider: 'github',
    owner: '0xmarkhydra',
    repo: 'ChatNet',
    releaseType: 'draft',
    channel: 'latest',
  }],
  win: { ...build.win, verifyUpdateCodeSignature: true },
  mac: { ...build.mac, notarize: true },
}
