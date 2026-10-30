'use strict'

// Disposable infrastructure only; never read or alter the project's normal database/Redis configuration.
const { execFileSync, spawnSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { resolve } = require('node:path')
const { mkdirSync, writeFileSync } = require('node:fs')
const root = resolve(__dirname, '../..')
const prefix = `soco-desktop-qa-${randomUUID().slice(0, 8)}`
const postgres = `${prefix}-pg`, redis = `${prefix}-redis`
const password = randomUUID()
const containers = []
function docker(...args) { return execFileSync('docker', args, { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function wait(name, command) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { docker('exec', name, ...command); return } catch { await delay(500) }
  }
  throw new Error(`Disposable ${name.endsWith('-pg') ? 'PostgreSQL' : 'Redis'} did not become ready`)
}
function port(name, containerPort) {
  const binding = docker('port', name, `${containerPort}/tcp`)
  if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('QA container binding must remain loopback-only')
  return binding.split(':')[1]
}
async function main() {
  try {
    docker('run', '--rm', '-d', '--name', postgres, '-p', '127.0.0.1::5432',
      '-e', 'POSTGRES_USER=socoqa', '-e', 'POSTGRES_DB=socoqa', '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine')
    containers.push(postgres)
    docker('run', '--rm', '-d', '--name', redis, '-p', '127.0.0.1::6379', 'redis:7-alpine')
    containers.push(redis)
    await Promise.all([wait(postgres, ['pg_isready', '-U', 'socoqa', '-d', 'socoqa']), wait(redis, ['redis-cli', 'ping'])])
    const result = spawnSync('go', ['test', '-p', '1', '-count=1', '-v', './...'], {
      cwd: resolve(root, 'backend'), encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env,
        CHATNET_TEST_DATABASE_URL: `postgres://socoqa:${password}@127.0.0.1:${port(postgres, 5432)}/socoqa?sslmode=disable`,
        CHATNET_TEST_REDIS_ADDR: `127.0.0.1:${port(redis, 6379)}`,
      },
    })
    const output = `${result.stdout || ''}${result.stderr || ''}`.replaceAll(password, '[QA-REDACTED]')
    const directory = resolve(root, 'frontend/output/desktop-smoke')
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, 'backend-integration.log'), output)
    const summary = output.split('\n').filter((line) => /^(ok\s|FAIL|--- (PASS|FAIL|SKIP):)|^\s+.*set CHATNET_TEST/.test(line))
    console.log(summary.join('\n'))
    if (result.error || result.status !== 0) throw new Error('Backend integration tests failed; inspect frontend/output/desktop-smoke/backend-integration.log')
    console.log('PASS: backend tests against disposable PostgreSQL/Redis; all skip reasons remain in the evidence log.')
  } finally {
    for (const name of containers.reverse()) {
      try { docker('stop', '--time', '5', name) } catch { console.error(`Cleanup required for QA container ${name}`); process.exitCode = 1 }
    }
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
