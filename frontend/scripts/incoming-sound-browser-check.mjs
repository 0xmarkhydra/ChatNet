import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer as createPortProbe } from 'node:net'
import { createServer } from 'vite'

// Real Chromium test: unlike a mock AudioContext, this checks the browser's
// user-gesture audio unlock and that a new SSE-style event schedules a tone.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = await new Promise((resolvePort, reject) => {
  const probe = createPortProbe()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address()
    probe.close(() => resolvePort(address.port))
  })
})
const vite = await createServer({
  root, configFile: resolve(root, 'vite.config.ts'),
  logLevel: 'silent', server: { host: '127.0.0.1', port, strictPort: true },
})
let browser
try {
  await vite.listen()
  const origin = 'http://127.0.0.1:' + vite.httpServer.address().port
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const { IncomingMessageSound } = await import('/src/features/notifications/lib/incomingSound.ts')
    const sound = new IncomingMessageSound()
    window.__soundProbe = sound
    const button = document.createElement('button')
    button.id = 'unlock-sound-check'
    button.textContent = 'Unlock sound'
    button.addEventListener('click', () => sound.unlock())
    document.body.appendChild(button)
  })
  await page.click('#unlock-sound-check')
  await page.waitForFunction(() => window.__soundProbe?.context?.state === 'running', { timeout: 5000 })
  const results = await page.evaluate(() => {
    const sound = window.__soundProbe
    const now = Date.now()
    return {
      audioContextState: sound.context?.state,
      incomingPlays: sound.onIncoming({ id: 100, senderId: 2, createdAt: new Date(now).toISOString() }, 1, true),
      ownMessageSilent: sound.onIncoming({ id: 101, senderId: 1, createdAt: new Date(now).toISOString() }, 1, true),
    }
  })
  assert.equal(results.audioContextState, 'running')
  assert.equal(results.incomingPlays, true, 'real Chromium must schedule an incoming tone after click')
  assert.equal(results.ownMessageSilent, false)
  console.log('PASS: real Chromium audio context unlocked by gesture; incoming tone scheduled; own message silent')
} finally {
  if (browser) await browser.close()
  await vite.close()
}
