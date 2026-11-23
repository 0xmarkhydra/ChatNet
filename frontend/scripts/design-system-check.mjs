import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const themeFile = join(frontendRoot, 'src/styles/soco-theme.css')
const tailwindFile = join(frontendRoot, 'src/styles/tailwind.css')
const uiFolder = join(frontendRoot, 'src/shared/ui')

export const tokenGroups = {
  font: ['font-sans', 'font-mono'],
  type: ['caption', 'label', 'body', 'subtitle', 'section', 'page', 'display'],
  spacing: ['1', '2', '3', '4', '5', '6', '8'],
  radius: ['sm', 'md', 'lg', 'xl'],
  shadow: ['sm', 'md', 'overlay'],
  statuses: ['success', 'warning', 'danger', 'info'],
  controls: ['sm', 'md', 'touch'],
  icons: ['sm', 'md', 'lg'],
  surfaces: ['input', 'page'],
  reactions: ['like', 'like-hover'],
  layers: ['raised', 'dropdown', 'overlay', 'modal'],
}

// Scan declarations rather than raw text so values in comments/documentation don't falsely fail.
export function findUnapprovedDeclarations(source) {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const issues = []
  const rules = [
    { name: 'hardcoded color', regex: /\b(?:color|background(?:-color)?|border(?:-color)?|outline-color|fill|stroke)\s*:\s*(?:#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\s*\()/g },
    { name: 'custom font-family', regex: /\bfont-family\s*:\s*[^;{}]+/g },
    { name: 'hardcoded typography or spacing', regex: /\b(?:font-size|gap|row-gap|column-gap|padding(?:-(?:top|right|bottom|left|inline|block))?|border-radius)\s*:\s*\d+(?:\.\d+)?(?:px|rem)\b/g },
  ]
  for (const rule of rules) {
    for (const match of stripped.matchAll(rule.regex)) {
      if (rule.name === 'custom font-family' && /:\s*var\(\s*--soco-font-/.test(match[0])) continue
      issues.push(`${rule.name}: ${match[0]}`)
    }
  }
  return issues
}

export function checkTokenContract(theme, tailwind) {
  const issues = []
  const requireToken = (source, token, label) => {
    if (!source.includes(token)) issues.push(`Missing ${label}: ${token}`)
  }

  for (const family of tokenGroups.font) {
    requireToken(theme, `--soco-${family}:`, 'font token')
    requireToken(tailwind, `--${family}: var(--soco-${family})`, 'Tailwind font mapping')
  }
  for (const type of tokenGroups.type) {
    requireToken(theme, `--soco-type-${type}:`, 'typography token')
    requireToken(tailwind, `--text-ui-${type}: var(--soco-type-${type})`, 'Tailwind typography mapping')
  }
  for (const space of tokenGroups.spacing) {
    requireToken(theme, `--soco-space-${space}:`, 'spacing token')
    requireToken(tailwind, `--spacing-ui-${space}: var(--soco-space-${space})`, 'Tailwind spacing mapping')
  }
  for (const radius of tokenGroups.radius) {
    requireToken(theme, `--soco-radius-${radius}:`, 'radius token')
    requireToken(tailwind, `--radius-ui-${radius}: var(--soco-radius-${radius})`, 'Tailwind radius mapping')
  }
  for (const shadow of tokenGroups.shadow) {
    requireToken(theme, `--soco-shadow-${shadow}:`, 'shadow token')
    requireToken(tailwind, `--shadow-ui-${shadow}: var(--soco-shadow-${shadow})`, 'Tailwind shadow mapping')
  }
  for (const status of tokenGroups.statuses) {
    requireToken(theme, `--soco-${status}:`, 'semantic status token')
    requireToken(tailwind, `--color-${status}: var(--soco-${status})`, 'Tailwind status mapping')
  }
  for (const name of tokenGroups.controls) {
    requireToken(theme, `--soco-control-${name}:`, 'control size token')
    requireToken(tailwind, `--spacing-control-${name}: var(--soco-control-${name})`, 'Tailwind control size mapping')
  }
  for (const name of tokenGroups.icons) {
    requireToken(theme, `--soco-icon-${name}:`, 'icon size token')
    requireToken(tailwind, `--spacing-icon-${name}: var(--soco-icon-${name})`, 'Tailwind icon size mapping')
  }
  for (const name of tokenGroups.surfaces) {
    requireToken(theme, `--soco-surface-${name}:`, 'surface token')
    requireToken(tailwind, `--color-surface-${name}: var(--soco-surface-${name})`, 'Tailwind surface mapping')
  }
  for (const name of tokenGroups.reactions) {
    requireToken(theme, `--soco-reaction-${name}:`, 'reaction color token')
    requireToken(tailwind, `--color-reaction-${name}: var(--soco-reaction-${name})`, 'Tailwind reaction mapping')
  }
  for (const name of tokenGroups.layers) requireToken(theme, `--soco-z-${name}:`, 'z-index layer token')
  requireToken(theme, 'outline: 3px solid var(--soco-focus-ring)', 'focus ring token usage')
  requireToken(theme, 'input:focus-visible:not([data-slot])', 'legacy focus ring opt-out for shared UI (data-slot)')
  requireToken(tailwind, '@custom-variant app-desktop (@media (min-width: 761px))', 'app-desktop breakpoint variant')
  requireToken(tailwind, '@custom-variant app-mobile (@media (max-width: 760px))', 'app-mobile breakpoint variant')
  requireToken(theme, '--soco-border-subtle:', 'subtle border token')
  requireToken(tailwind, '--color-border-subtle: var(--soco-border-subtle)', 'Tailwind subtle border mapping')
  if (!tailwind.includes('Preflight is intentionally disabled')) {
    issues.push('Missing no-Preflight policy comment')
  }
  if (/tailwindcss\/preflight|@import\s+["']tailwindcss["']/.test(tailwind)) {
    issues.push('Tailwind Preflight must remain disabled')
  }
  return issues
}

// Existing shared UI sheets predate this gate. They remain unchanged until their owners migrate them.
// Only *new* CSS files are blocked on arbitrary values, without retroactive design changes.
const legacySharedUiCss = new Set([
  'bubble-textarea.css',
  'connection-tools.css',
  'media-viewer.css',
  'reaction-participants.css',
])

function walkStyles(directory) {
  const css = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) css.push(...walkStyles(path))
    else if (entry.isFile() && entry.name.endsWith('.css')) css.push(path)
  }
  return css
}

export function runDesignSystemCheck() {
  const issues = checkTokenContract(readFileSync(themeFile, 'utf8'), readFileSync(tailwindFile, 'utf8'))
  for (const path of walkStyles(uiFolder)) {
    if (legacySharedUiCss.has(path.split(/[\\/]/).at(-1))) continue
    for (const finding of findUnapprovedDeclarations(readFileSync(path, 'utf8'))) {
      issues.push(`${path.slice(frontendRoot.length + 1)}: ${finding}`)
    }
  }
  return issues
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = runDesignSystemCheck()
  if (issues.length) {
    console.error('FAIL: SocCO design system gate')
    issues.forEach((issue) => console.error(' - ' + issue))
    process.exitCode = 1
  } else {
    console.log('PASS: SocCO token contract, Tailwind policy and shared/ui CSS declarations')
  }
}