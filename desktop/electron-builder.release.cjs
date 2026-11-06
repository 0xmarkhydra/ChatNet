'use strict'

// Only signed public releases opt in. Internal builds retain publish:null and
// contain no app-update.yml, so no test/unsigned artifact can enroll in updates.
// SOCO_DESKTOP_UPDATE_URL is set by the release operator at build time, never
// accepted from the renderer or read from the end user's environment.
const { isIP } = require('node:net')
const appBuild = require('./package.json').build
const raw = process.env.SOCO_DESKTOP_UPDATE_URL
if (!raw) throw new Error('SOCO_DESKTOP_UPDATE_URL is required for signed update releases')
let endpoint
try { endpoint = new URL(raw) } catch { throw new Error('Invalid desktop update feed URL') }
if (endpoint.protocol !== 'https:' || !endpoint.hostname.includes('.') ||
    isIP(endpoint.hostname.replaceAll('[', '').replaceAll(']', '')) ||
    !endpoint.pathname.endsWith('/') || endpoint.username || endpoint.password ||
    endpoint.search || endpoint.hash || endpoint.port ||
    /^(?:localhost|127[.]|0[.]|10[.]|192[.]168[.]|169[.]254[.]|172[.](?:1[6-9]|2[0-9]|3[01])[.])/i.test(endpoint.hostname) ||
    endpoint.hostname.endsWith('.local')) {
  throw new Error('Desktop update feed must use a public, credential-free HTTPS origin')
}
module.exports = {
  ...appBuild,
  publish: [{ provider: 'generic', url: endpoint.toString() }],
  win: { ...appBuild.win, verifyUpdateCodeSignature: true },
}