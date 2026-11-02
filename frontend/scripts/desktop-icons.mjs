import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Rasterize the existing reviewed SOCO brand asset, not a new logo/design.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const svg = await readFile(resolve(root, 'frontend/public/soco-mark.svg'), 'utf8')
assert.ok(!/<script|<foreignObject|(?:href|src)\s*=|url\(https?:/i.test(svg), 'icon must remain self-contained')
const out = resolve(root, 'desktop/assets')
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })
  await page.route('**/*', route => route.abort())
  await page.setContent(`<style>html,body{margin:0;width:1024px;height:1024px}svg{display:block;width:1024px;height:1024px}</style>${svg}`)
  const png = await page.screenshot({ omitBackground: true })
  assert.equal(png.readUInt32BE(16), 1024)
  assert.equal(png.readUInt32BE(20), 1024)
  await writeFile(resolve(out, 'icon.png'), png)
  await writeFile(resolve(out, 'icon-provenance.json'), JSON.stringify({ source: 'frontend/public/soco-mark.svg',
    sourceSha256: createHash('sha256').update(svg).digest('hex'), pngSha256: createHash('sha256').update(png).digest('hex'), size: 1024 }, null, 2) + '\n')
  console.log('PASS: self-contained existing SOCO SVG rasterized to 1024px installer icon with SHA-256 provenance')
} finally { await browser.close() }
