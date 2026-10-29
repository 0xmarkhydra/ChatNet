import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { setTimeout as delay } from 'node:timers/promises'

const origin = 'http://127.0.0.1:5198'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
server.stdout.on('data', chunk => { output = (output + chunk).slice(-8000) })
server.stderr.on('data', chunk => { output = (output + chunk).slice(-8000) })
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite exited: ' + output)
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(100)
  }
  if (!ready) throw new Error('Vite did not start: ' + output)
  const channel = process.argv.find(arg => arg.startsWith('--channel='))?.slice('--channel='.length)
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin + '/scripts/app-data-fixture.html')
  try {
    await page.waitForFunction(() => document.body.dataset.result === 'passed', undefined, { timeout: 15000 })
  } catch (error) {
    throw new Error(errors.join('\n') || String(error))
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('PASS: real React data hooks; membership partial failure, session isolation, contact races, feed locks and mutation cleanup.')
} finally {
  if (browser) await browser.close()
  server.kill()
}