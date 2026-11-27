import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const baselinePath = fileURLToPath(new URL('./i18n-hardcode-baseline.json', import.meta.url))
const vietnamese = /[ăâđêôơưĂÂĐÊÔƠƯ\u1ea0-\u1ef9àáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/u
const displayAttrs = new Set(['aria-label', 'aria-description', 'placeholder', 'title', 'alt', 'label', 'description', 'emptyLabel', 'hint', 'message', 'data-tooltip', 'tooltip', 'ariaLabel'])
const additionalAttrs = new Set(['emptyText', 'prompt', 'clearLabel', 'subtitle'])
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : []
  })
}
export function findHardcodedUI(source, filename, extended = false) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const hits = []
  function add(node, value, kind) {
    const text = value.replace(/\s+/g, ' ').trim()
    if (text && vietnamese.test(text)) hits.push({ text, kind, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 })
  }
  function inspectExpression(node, kind) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, node.text, kind)
    else if (ts.isTemplateExpression(node)) add(node, node.head.text + node.templateSpans.map(span => '{value}' + span.literal.text).join(''), kind)
    else if (ts.isConditionalExpression(node)) {
      inspectExpression(node.whenTrue, kind)
      inspectExpression(node.whenFalse, kind)
    } else if (ts.isParenthesizedExpression(node)) inspectExpression(node.expression, kind)
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) inspectExpression(node.right, kind)
  }
  function visit(node) {
    if (ts.isJsxText(node)) add(node, node.getText(tree), 'text')
    if (ts.isJsxAttribute(node) && (displayAttrs.has(node.name.getText(tree)) || extended && additionalAttrs.has(node.name.getText(tree))) && node.initializer) {
      const v = node.initializer
      if (ts.isStringLiteral(v)) add(v, v.text, 'attribute')
      else if (ts.isJsxExpression(v) && v.expression) inspectExpression(v.expression, 'attribute')
    }
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) inspectExpression(node.expression, 'text')
    if (ts.isCallExpression(node) && node.arguments.length && ['setNotice', 'setAuthError', 'onFeedback', 'notify'].includes(node.expression.getText(tree))) {
      inspectExpression(node.arguments[0], 'notice')
    }
    // Extended audit deliberately reports candidates, not guaranteed UI copy.
    // Object labels/default parameters were previously invisible to the JSX audit.
    if (extended && ts.isPropertyAssignment(node) && (displayAttrs.has(node.name.getText(tree).replace(/^['"]|['"]$/g, '')) || additionalAttrs.has(node.name.getText(tree).replace(/^['"]|['"]$/g, '')))) inspectExpression(node.initializer, 'config')
    if (extended && ts.isBindingElement(node) && node.initializer && (displayAttrs.has((node.propertyName || node.name).getText(tree)) || additionalAttrs.has((node.propertyName || node.name).getText(tree)))) inspectExpression(node.initializer, 'default')
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return hits
}
function scan() {
  return walk(root).sort().flatMap(file => {
    const relative = path.relative(root, file).replaceAll('\\', '/')
    if (relative.includes('/i18n/') || relative.startsWith('shared/i18n/')) return []
    return findHardcodedUI(fs.readFileSync(file, 'utf8'), file, process.argv.includes('--extended')).map(hit => ({ file: relative, ...hit }))
  })
}
function counts(hits) {
  const result = {}
  for (const hit of hits) {
    const key = JSON.stringify([hit.file, hit.kind, hit.text])
    result[key] = (result[key] || 0) + 1
  }
  return result
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hits = scan()
  const modules = {}
  for (const hit of hits) {
    const parts = hit.file.split('/')
    const name = parts[0] === 'features' ? parts[1] : parts[0]
    modules[name] = (modules[name] || 0) + 1
  }
  console.log(JSON.stringify({ total: hits.length, files: new Set(hits.map(h => h.file)).size, modules }))
  if (process.argv.includes('--report')) {
    for (const [label, count] of Object.entries(hits.reduce((acc, h) => { acc[h.text] = (acc[h.text] || 0) + 1; return acc }, {})).sort((a,b) => b[1]-a[1])) console.log(count + '\t' + label)
  } else if (process.argv.includes('--inventory') || process.argv.includes('--extended')) {
    for (const h of hits) console.log(h.file + ':' + h.line + '\t' + h.kind + '\t' + h.text)
  } else if (process.argv.includes('--init-baseline')) {
    if (fs.existsSync(baselinePath)) throw new Error('Baseline already exists; do not increase the debt ceiling')
    fs.writeFileSync(baselinePath, JSON.stringify(counts(hits), null, 2) + '\n')
  } else {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    const violations = Object.entries(counts(hits)).filter(([key, count]) => count > (baseline[key] || 0))
    if (violations.length) {
      for (const [key, count] of violations) console.error('New hardcoded UI:', key, count)
      process.exitCode = 1
    } else console.log('PASS: no new Vietnamese hardcoded JSX text/attributes')
  }
}