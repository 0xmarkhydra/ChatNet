// Design-debt ratchet: hardcoded colours, pixel values, breakpoints, important flags and legacy selectors
// are recorded per file in design-debt-baseline.json. They may only go down.
//
//   npm run check:design-debt      compare against the baseline (fails on any file/metric that got worse)
//   npm run design-debt:report     print totals per metric and per area, plus probably-dead CSS and unused tokens
//   npm run design-debt:baseline   rewrite the baseline after debt was removed
//
// Opt out of a single line with a comment that gives the reason: `design-debt-ignore: <reason>`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  METRICS, findImprovements, findOrphanTokens, findRegressions, findUnimportedCss, measureDesignDebt, summarizeByArea,
} from './design-debt-lib.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const baselineFile = new URL('../design-debt-baseline.json', import.meta.url)
const mode = process.argv.includes('--update') ? 'update' : process.argv.includes('--report') ? 'report' : 'check'

const { counts, totals } = measureDesignDebt(root)

function printTotals(baselineTotals) {
  console.log('Design debt (current' + (baselineTotals ? ' / baseline' : '') + '):')
  for (const [metric, label] of Object.entries(METRICS)) {
    const before = baselineTotals ? ` / ${String(baselineTotals[metric] ?? 0).padStart(5)}` : ''
    console.log(`  ${String(totals[metric]).padStart(5)}${before}  ${metric.padEnd(24)} ${label}`)
  }
}

if (mode === 'update') {
  writeFileSync(baselineFile, JSON.stringify({ totals, counts }, null, 2) + '\n')
  printTotals()
  console.log(`\nBaseline updated: ${Object.keys(counts).length} file/metric pairs.`)
  process.exit(0)
}

if (mode === 'report') {
  printTotals(existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')).totals : undefined)
  const areas = summarizeByArea(counts)
  const weight = (area) => Object.values(areas[area]).reduce((sum, value) => sum + value, 0)
  console.log('\nTop areas by total debt:')
  for (const area of Object.keys(areas).sort((a, b) => weight(b) - weight(a)).slice(0, 15)) {
    const detail = Object.entries(areas[area]).map(([metric, value]) => `${metric}=${value}`).join(' ')
    console.log(`  ${String(weight(area)).padStart(5)}  ${area}  (${detail})`)
  }
  const dead = findUnimportedCss(root)
  console.log(`\nCSS files nothing imports (${dead.length}):`)
  dead.forEach((file) => console.log('  ' + file))
  const orphans = findOrphanTokens(root)
  console.log(`\nTheme tokens never referenced via var() (${orphans.length}; may still be consumed by Tailwind @theme mappings):`)
  orphans.forEach((token) => console.log('  ' + token))
  process.exit(0)
}

if (!existsSync(baselineFile)) {
  console.error('design-debt-baseline.json is missing. Run: npm run design-debt:baseline')
  process.exit(1)
}
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
printTotals(baseline.totals)
const regressions = findRegressions(baseline.counts, counts)
const improved = findImprovements(baseline.counts, counts)
if (improved.length) {
  console.log(`\n${improved.length} file/metric pair(s) improved. Lock it in with: npm run design-debt:baseline`)
}
if (regressions.length) {
  console.error(`\nFAIL: ${regressions.length} file/metric pair(s) got worse than the baseline:`)
  regressions.slice(0, 40).forEach((line) => console.error('  ' + line))
  console.error('\nUse an existing SocCO token or utility instead (see docs/engineering/UI_FOUNDATION.md).')
  console.error('If a value is legitimately fixed (SVG, canvas, third-party), add "design-debt-ignore: <reason>" on that line.')
  process.exit(1)
}
console.log('\nPASS: no new design debt compared to the baseline.')
