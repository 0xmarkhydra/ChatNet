// Real-browser unit check for useScopedState (no extra test dependency): the hook is bundled
// with React into a tiny harness page and driven from Playwright.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({
  stdin: {
    resolveDir: root,
    sourcefile: 'scoped-state-harness.js',
    contents: `
      import { StrictMode, createElement as h } from 'react'
      import { createRoot } from 'react-dom/client'
      import { flushSync } from 'react-dom'
      import { useScopedState } from './src/shared/hooks/useScopedState.ts'
      const NO_ITEMS = []
      window.__setup = (strict) => {
        const log = { renders: [], setters: {}, items: [] }
        let api = null
        function Probe({ scope }) {
          const [value, setValue] = useScopedState(scope, 'init')
          const [items, setItems] = useScopedState(scope, NO_ITEMS)
          log.renders.push({ scope, value })
          log.setters[scope] = setValue
          log.items.push(items)
          api = { setValue, setItems, value, items }
          return h('output', { id: 'out' }, String(value))
        }
        const container = document.createElement('div')
        document.body.append(container)
        const root = createRoot(container)
        const wrap = (scope) => strict ? h(StrictMode, null, h(Probe, { scope })) : h(Probe, { scope })
        return {
          log,
          show: (scope) => flushSync(() => root.render(wrap(scope))),
          set: (value) => flushSync(() => api.setValue(value)),
          setItems: (value) => flushSync(() => api.setItems(value)),
          callOld: (scope, value) => flushSync(() => log.setters[scope](value)),
          text: () => container.querySelector('#out').textContent,
          items: () => api.items,
          sameEmptyItems: () => api.items === NO_ITEMS,
          unmount: () => root.unmount(),
        }
      }
    `,
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' },
})

let browser
for (const channel of [undefined, 'msedge', 'chrome']) {
  try { browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) }); break }
  catch (error) { if (!/doesn't exist|not found|Executable/.test(String(error))) throw error }
}
assert.ok(browser, 'NOT RUN: no Chromium, Edge or Chrome available for Playwright')
try {
  for (const strict of [false, true]) {
    const label = strict ? 'StrictMode' : 'normal'
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.setContent('<!doctype html><body></body>')
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    const run = (body) => page.evaluate(`(() => { const t = window.__setup(${strict}); ${body} })()`)

    // 1 + 2: A -> B resets, A -> B -> A does not revive the old value, and B never renders A's value
    const flow = await run(`
      t.show('A'); t.set('from A'); const a1 = t.text()
      t.show('B'); const b1 = t.text()
      t.show('A'); const a2 = t.text()
      const leaked = t.log.renders.filter(r => r.scope === 'B' && r.value === 'from A').length
      return { a1, b1, a2, leaked }`)
    assert.deepEqual(flow, { a1: 'from A', b1: 'init', a2: 'init', leaked: 0 }, label + ': conversation switch resets without a stale frame or revival')

    // 3: channel scopes (conversation:channel) 1 -> 2 -> 1
    const channels = await run(`
      t.show('7:1'); t.set('channel 1'); t.show('7:2'); const two = t.text(); t.show('7:1'); const one = t.text()
      return { two, one }`)
    assert.deepEqual(channels, { two: 'init', one: 'init' }, label + ': channel switch resets')

    // 4: an async callback from the old scope finishing late cannot change the new scope
    const late = await run(`
      t.show('A'); t.show('B'); t.set('B value')
      t.callOld('A', 'LATE A'); t.callOld('A', (v) => v + ' + late updater')
      return t.text()`)
    assert.equal(late, 'B value', label + ': stale setter from the previous scope is ignored')

    // 5: functional updaters compose
    const updater = await run(`
      t.show('A'); t.set((v) => v + '1'); t.set((v) => v + '2'); return t.text()`)
    assert.equal(updater, 'init12', label + ': functional updater receives the latest value')

    // 6: no render loop and a constant initial array keeps its identity
    const stable = await run(`
      t.show('A'); t.show('B'); t.show('A'); t.show('B')
      t.setItems((items) => [...items, 1])
      const grown = t.items().length
      t.show('C')
      return { renders: t.log.renders.length, grown, sameEmpty: t.sameEmptyItems() }`)
    assert.ok(stable.renders < 40, label + ': bounded renders (' + stable.renders + ')')
    assert.equal(stable.grown, 1)
    assert.equal(stable.sameEmpty, true, label + ': reset restores the same initial array')

    assert.deepEqual(errors, [], label + ': no console or page errors')
    await page.close()
  }
  console.log('PASS: useScopedState (switch, A-B-A, channel, stale callback, updater, StrictMode)')
} finally {
  await browser.close()
}
