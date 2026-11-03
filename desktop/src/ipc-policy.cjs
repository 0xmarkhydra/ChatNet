'use strict'

const TRUSTED_PROD_ORIGIN = 'app://soco'
const TRUSTED_DEV_ORIGIN = 'http://127.0.0.1:5173'

function trustedRendererURL(rawURL, dev = false) {
  try {
    const url = new URL(rawURL)
    if (dev) return url.origin === TRUSTED_DEV_ORIGIN
    // The WHATWG URL parser reports origin="null" for custom app:// schemes.
    return url.protocol === 'app:' && url.hostname === 'soco' && !url.username && !url.password && !url.port
  } catch {
    return false
  }
}

// External links are deliberately restricted during the native-shell spike.
const EXTERNAL_HOSTS = new Set(['chat.codelocal.cloud', 'codelocal.cloud'])
function safeExternalURL(input) {
  if (typeof input !== 'string' || input.length > 2048) return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !EXTERNAL_HOSTS.has(url.hostname)) return null
    return url.href
  } catch {
    return null
  }
}

function isSafeAssetPath(root, pathName) {
  if (typeof pathName !== 'string' || !pathName.startsWith('/') || pathName.includes('\\') ||
      /%2f|%5c|%00/i.test(pathName)) return null
  try {
    const { resolve, relative, isAbsolute } = require('node:path')
    const decoded = decodeURIComponent(pathName)
    if (decoded.includes('\0') || decoded.includes('\\')) return null
    const target = resolve(root, '.' + decoded)
    const diff = relative(root, target)
    if (diff.startsWith('..') || isAbsolute(diff)) return null
    return target
  } catch {
    return null
  }
}

module.exports = { trustedRendererURL, safeExternalURL, isSafeAssetPath }