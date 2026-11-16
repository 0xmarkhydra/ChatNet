'use strict'

const { version } = require('../package.json')

function checkReleaseTag(tag) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag || '')) {
    throw new Error('Release tag must be in the form vMAJOR.MINOR.PATCH')
  }
  if (tag !== `v${version}`) {
    throw new Error(`Tag ${tag} does not match desktop/package.json version ${version}`)
  }
  return tag
}

if (require.main === module) {
  try {
    checkReleaseTag(process.argv[2])
    console.log(`Verified desktop release tag: ${process.argv[2]}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { checkReleaseTag }
