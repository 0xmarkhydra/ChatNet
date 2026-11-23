// Measures hardcoded design values that should become SocCO tokens or Tailwind utilities.
// Counting is deterministic so the same source always yields the same numbers (see design-debt-ratchet.mjs).
//
// A line can opt out with a comment that states why, e.g.
//   /* design-debt-ignore: brand gradient from the logo asset */
//   // design-debt-ignore: third-party widget requires this exact colour
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

export const METRICS = {
  'css.hex': 'Hex colour in a CSS declaration',
  'css.important': '!important in CSS',
  'css.shellSelector': '.modern-shell.app-layout selector (high specificity)',
  'css.zIndex': 'Literal z-index in CSS',
  'tsx.arbitraryHex': 'Tailwind arbitrary colour, e.g. bg-[#2563eb]',
  'tsx.arbitraryPx': 'Tailwind arbitrary pixel value, e.g. h-[44px]',
  'tsx.arbitraryBreakpoint': 'Tailwind arbitrary breakpoint, e.g. min-[761px]:',
  'tsx.importantModifier': 'Tailwind important modifier, e.g. px-4!',
  'tsx.zIndex': 'Literal z-index in TSX/TS',
}

const IGNORE = /design-debt-ignore:\s*[^\s*/]/
const SINGLE_WORD_UTILITIES = new Set([
  'flex', 'block', 'hidden', 'grid', 'inline', 'static', 'fixed', 'absolute', 'relative', 'sticky',
  'truncate', 'italic', 'uppercase', 'contents', 'border', 'underline', 'grow', 'shrink', 'visible', 'invisible',
])

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage'])
const isTest = (name) => /\.(test|spec|selfcheck|nodecheck)\.[cm]?[jt]sx?$/.test(name)

function walk(directory, extensions, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(path, extensions, found)
    } else if (extensions.some((extension) => entry.name.endsWith(extension)) && !isTest(entry.name)) {
      found.push(path)
    }
  }
  return found
}

// Replaces comments with their newlines so line numbers stay stable; lines that carried an ignore marker are dropped.
export function prepareLines(source, { css }) {
  const ignored = new Set()
  source.split('\n').forEach((line, index) => { if (IGNORE.test(line)) ignored.add(index) })
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
  return stripped.split('\n').map((line, index) => {
    if (ignored.has(index)) return ''
    if (!css && line.trimStart().startsWith('//')) return ''
    return line
  })
}

export function countCssDebt(source) {
  const counts = {}
  const add = (metric, amount) => { if (amount) counts[metric] = (counts[metric] || 0) + amount }
  for (const line of prepareLines(source, { css: true })) {
    if (line.includes(':') && !line.trimEnd().endsWith('{')) {
      add('css.hex', (line.match(/(?<=[:,\s(])#[0-9a-fA-F]{3,8}\b/g) || []).length)
    }
    add('css.important', (line.match(/!important/g) || []).length)
    add('css.shellSelector', (line.match(/\.modern-shell\.app-layout/g) || []).length)
    add('css.zIndex', (line.match(/z-index\s*:\s*-?\d+/g) || []).length)
  }
  return counts
}

function importantModifiers(line) {
  let total = 0
  for (const literal of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
    for (const token of literal[2].split(/\s+/)) {
      if (token.length < 2 || !token.endsWith('!') || !/[\w\])%]!$/.test(token) || token.includes('=')) continue
      if (/[-:[]/.test(token) || SINGLE_WORD_UTILITIES.has(token.slice(0, -1))) total += 1
    }
  }
  return total
}

export function countSourceDebt(source) {
  const counts = {}
  const add = (metric, amount) => { if (amount) counts[metric] = (counts[metric] || 0) + amount }
  for (const line of prepareLines(source, { css: false })) {
    add('tsx.arbitraryHex', (line.match(/\[#[0-9a-fA-F]{3,8}\]/g) || []).length)
    add('tsx.arbitraryBreakpoint', (line.match(/\b(?:min|max)-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g) || []).length)
    add('tsx.arbitraryPx', (line.match(/(?<!(?:min|max)-)\[\d+(?:\.\d+)?px\]/g) || []).length)
    add('tsx.importantModifier', importantModifiers(line))
    add('tsx.zIndex', (line.match(/\bz-\[-?\d+\]|\bzIndex\s*:\s*-?\d+/g) || []).length)
  }
  return counts
}

const posix = (path) => path.split(sep).join('/')

/** Returns { counts: { 'path|metric': n }, totals: { metric: n } } for everything under src. */
export function measureDesignDebt(frontendRoot) {
  const sourceRoot = join(frontendRoot, 'src')
  const counts = {}
  const record = (file, found) => {
    for (const [metric, amount] of Object.entries(found)) counts[`${posix(relative(frontendRoot, file))}|${metric}`] = amount
  }
  for (const file of walk(sourceRoot, ['.css'])) record(file, countCssDebt(readFileSync(file, 'utf8')))
  for (const file of walk(sourceRoot, ['.tsx', '.ts'])) record(file, countSourceDebt(readFileSync(file, 'utf8')))
  const totals = Object.fromEntries(Object.keys(METRICS).map((metric) => [metric, 0]))
  for (const [key, amount] of Object.entries(counts)) totals[key.split('|')[1]] += amount
  return { counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))), totals }
}

/** CSS files that nothing imports (from TS/TSX `import` or CSS `@import`), so they are probably dead. */
export function findUnimportedCss(frontendRoot) {
  const sourceRoot = join(frontendRoot, 'src')
  const imported = new Set()
  const sources = [...walk(sourceRoot, ['.ts', '.tsx', '.css']), join(frontendRoot, 'index.html')]
  for (const file of sources) {
    let text
    try { text = readFileSync(file, 'utf8') } catch { continue }
    for (const match of text.matchAll(/(?:import\s+(?:[^'"]*from\s+)?|@import\s+(?:url\()?|src=)["']([^"']+\.css)["']/g)) {
      const target = match[1].startsWith('/') ? join(frontendRoot, match[1]) : resolve(dirname(file), match[1])
      imported.add(posix(relative(frontendRoot, target)))
    }
  }
  return walk(sourceRoot, ['.css'])
    .map((file) => posix(relative(frontendRoot, file)))
    .filter((file) => !imported.has(file))
}

/** `--soco-*` tokens that are defined in the theme but never referenced anywhere else. */
export function findOrphanTokens(frontendRoot) {
  const theme = readFileSync(join(frontendRoot, 'src/styles/soco-theme.css'), 'utf8')
  const defined = [...new Set([...theme.matchAll(/^\s*(--soco-[\w-]+)\s*:/gm)].map((match) => match[1]))]
  const used = new Set()
  for (const file of walk(join(frontendRoot, 'src'), ['.css', '.ts', '.tsx'])) {
    for (const match of readFileSync(file, 'utf8').matchAll(/var\(\s*(--soco-[\w-]+)/g)) used.add(match[1])
  }
  return defined.filter((token) => !used.has(token))
}

/** Most common 6-digit hex values in CSS/TSX with the existing token that has exactly that value, if any. */
export function topColours(frontendRoot, limit = 20) {
  const theme = readFileSync(join(frontendRoot, 'src/styles/soco-theme.css'), 'utf8')
  const tokens = {}
  for (const match of theme.matchAll(/^\s*(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/gm)) {
    const hex = match[2].toLowerCase()
    tokens[hex] = tokens[hex] || match[1]
  }
  const found = {}
  for (const file of walk(join(frontendRoot, 'src'), ['.css', '.tsx', '.ts'])) {
    const css = file.endsWith('.css')
    for (const line of prepareLines(readFileSync(file, 'utf8'), { css })) {
      if (css && !line.includes(':')) continue
      for (const match of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const hex = match[0].toLowerCase()
        const lower = line.toLowerCase()
        found[hex] ||= { total: 0, fallback: 0 }
        found[hex].total += 1
        if (lower.includes(', ' + hex + ')') || lower.includes(',' + hex + ')')) found[hex].fallback += 1
      }
    }
  }
  return Object.entries(found).sort((a, b) => b[1].total - a[1].total).slice(0, limit)
    .map(([hex, count]) => ({ hex, ...count, token: tokens[hex] }))
}

/** File/metric pairs that got worse than the baseline. New files with debt count as worse. */
export function findRegressions(baseline, current) {
  return Object.entries(current)
    .filter(([key, amount]) => amount > (baseline[key] || 0))
    .map(([key, amount]) => `${key}  ${baseline[key] || 0} -> ${amount}`)
}

export function findImprovements(baseline, current) {
  return Object.entries(baseline)
    .filter(([key, before]) => (current[key] || 0) < before)
    .map(([key, before]) => `${key}  ${before} -> ${current[key] || 0}`)
}

/** Debt per feature (src/features/<name>) or area (first two path segments) for the report. */
export function summarizeByArea(counts) {
  const areas = {}
  for (const [key, amount] of Object.entries(counts)) {
    const [file, metric] = key.split('|')
    const parts = file.split('/')
    const area = parts[1] === 'features' ? `features/${parts[2]}` : parts.slice(1, 3).join('/').replace(/\.[^.]+$/, '')
    areas[area] ||= {}
    areas[area][metric] = (areas[area][metric] || 0) + amount
  }
  return areas
}
