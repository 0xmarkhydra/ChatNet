'use strict'

const fs = require('node:fs')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function validCredential(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'refreshToken,sessionId,userId,version' &&
    value.version === 1 && typeof value.sessionId === 'string' && UUID.test(value.sessionId) &&
    typeof value.refreshToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.refreshToken) &&
    Number.isSafeInteger(value.userId) && value.userId > 0
}

// This module is Main-only. No API returns the vault bytes or a credential to IPC.
function createCredentialVault(directory, safeStorage, platform = process.platform) {
  const file = join(directory, 'session.bin')
  function available() {
    if (!['darwin', 'win32'].includes(platform) || !safeStorage.isEncryptionAvailable()) {
      throw new Error('VAULT_UNAVAILABLE')
    }
  }
  function read() {
    let encrypted
    try {
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error('VAULT_INVALID')
      encrypted = fs.readFileSync(file)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw new Error('VAULT_UNREADABLE')
    }
    available()
    try {
      const record = JSON.parse(safeStorage.decryptString(encrypted))
      if (!validCredential(record)) throw new Error('invalid credential')
      return record
    } catch {
      throw new Error('VAULT_INVALID')
    }
  }
  function write(record) {
    available()
    if (!validCredential(record)) throw new Error('VAULT_INVALID')
    const encrypted = safeStorage.encryptString(JSON.stringify(record))
    if (!Buffer.isBuffer(encrypted) || encrypted.length === 0 || encrypted.length > 16384) {
      throw new Error('VAULT_UNAVAILABLE')
    }
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    const temporary = join(directory, `session-${randomUUID()}.tmp`)
    let descriptor
    try {
      descriptor = fs.openSync(temporary, 'wx', 0o600)
      fs.writeFileSync(descriptor, encrypted)
      fs.fsyncSync(descriptor)
      fs.closeSync(descriptor)
      descriptor = undefined
      fs.renameSync(temporary, file)
    } catch {
      throw new Error('VAULT_WRITE_FAILED')
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor)
      try { fs.unlinkSync(temporary) } catch (error) {
        if (error.code !== 'ENOENT') throw new Error('VAULT_WRITE_FAILED')
      }
    }
  }
  function clear() {
    try { fs.unlinkSync(file) } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('VAULT_CLEAR_FAILED')
    }
  }
  return { available, read, write, clear }
}

module.exports = { createCredentialVault, validCredential, UUID }
