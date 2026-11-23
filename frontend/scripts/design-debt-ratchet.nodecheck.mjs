import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countCssDebt, countSourceDebt, findImprovements, findRegressions, summarizeByArea,
} from './design-debt-lib.mjs'

test('CSS debt counts hex, important, legacy selector and z-index in declarations', () => {
  const counts = countCssDebt(`
    .modern-shell.app-layout .card {
      color: #2563eb;
      background: linear-gradient(90deg, #fff, #eee) !important;
      z-index: 20;
    }`)
  assert.deepEqual(counts, { 'css.hex': 3, 'css.important': 1, 'css.shellSelector': 1, 'css.zIndex': 1 })
})

test('CSS comments, id selectors and token usage are not debt', () => {
  assert.deepEqual(countCssDebt('/* color: #fff !important; z-index: 9 */\n#feed { padding: var(--soco-space-3); }\n.a{color:var(--soco-text)}'), {})
})

test('design-debt-ignore with a reason skips the line, an empty marker does not', () => {
  assert.deepEqual(countCssDebt('.a { color: #fff; } /* design-debt-ignore: logo asset */'), {})
  assert.deepEqual(countCssDebt('.a { color: #fff; } /* design-debt-ignore: */'), { 'css.hex': 1 })
  assert.deepEqual(countSourceDebt('const c = "bg-[#fff]" // design-debt-ignore: third-party theme'), {})
})

test('Tailwind debt counts arbitrary colours, pixels, breakpoints, important and z-index', () => {
  const counts = countSourceDebt(
    `<div className="min-[761px]:bg-[#f8fafe] h-[45px] px-4! flex! [&>*]:p-2! z-[70] rounded-ui-md" style={{ zIndex: 5 }} />`,
  )
  assert.deepEqual(counts, {
    'tsx.arbitraryHex': 1, 'tsx.arbitraryBreakpoint': 1, 'tsx.arbitraryPx': 1, 'tsx.importantModifier': 3, 'tsx.zIndex': 2,
  })
})

test('breakpoints are not double-counted as pixel values and grid templates are ignored', () => {
  assert.deepEqual(countSourceDebt('<div className="max-[760px]:hidden grid-cols-[320px_1fr] gap-ui-3" />'), { 'tsx.arbitraryBreakpoint': 1 })
})

test('UI text with an exclamation mark is not an important modifier', () => {
  assert.deepEqual(countSourceDebt(`toast('Đã lưu thành công!') ; const x = a!.b`), {})
})

test('ratchet allows reductions and rejects any increase, including new files', () => {
  const baseline = { 'a.css|css.hex': 5, 'b.css|css.hex': 2 }
  assert.deepEqual(findRegressions(baseline, { 'a.css|css.hex': 4, 'b.css|css.hex': 2 }), [])
  assert.deepEqual(findRegressions(baseline, { 'a.css|css.hex': 6 }), ['a.css|css.hex  5 -> 6'])
  assert.deepEqual(findRegressions(baseline, { 'c.css|css.hex': 1 }), ['c.css|css.hex  0 -> 1'])
  assert.deepEqual(findImprovements(baseline, { 'a.css|css.hex': 4 }), ['a.css|css.hex  5 -> 4', 'b.css|css.hex  2 -> 0'])
})

test('report groups debt by feature', () => {
  const areas = summarizeByArea({ 'src/features/feed/a.css|css.hex': 2, 'src/features/feed/b.tsx|tsx.arbitraryPx': 1, 'src/styles/x.css|css.hex': 4 })
  assert.deepEqual(areas['features/feed'], { 'css.hex': 2, 'tsx.arbitraryPx': 1 })
  assert.deepEqual(areas['styles/x'], { 'css.hex': 4 })
})
