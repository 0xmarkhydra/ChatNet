// Development-time catalogue check and incremental translation. Runtime never calls AI.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../src/shared/i18n/locales/', import.meta.url))
export const locales = ['vi', 'en', 'zh', 'ja', 'ko']
const modules = fs.readdirSync(path.join(root, 'vi')).filter(name => name.endsWith('.ts') && name !== 'index.ts').map(name => name.slice(0,-3)).sort()
const placeholders = text => (text.match(/\{\w+\}/g) || []).sort().join(',')
const viLetters = /[ăâđêôơưĂÂĐÊÔƠƯ\u1ea0-\u1ef9àáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/u
const keyPattern = /^[a-z][\w]*(?:\.[\w]+)+$/

export function parseCatalog(source, filename) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  if (tree.parseDiagnostics.length || tree.statements.length !== 1 || !ts.isExportAssignment(tree.statements[0])) throw new Error('Invalid catalog: ' + filename)
  let node = tree.statements[0].expression
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression
  if (!ts.isObjectLiteralExpression(node)) throw new Error('Expected literal catalog: ' + filename)
  const data = Object.create(null)
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop) || (!ts.isStringLiteral(prop.name) && !ts.isIdentifier(prop.name)) || !ts.isStringLiteral(prop.initializer)) throw new Error('Only string entries are allowed: ' + filename)
    const key = prop.name.text
    if (Object.hasOwn(data, key) || !keyPattern.test(key) || !prop.initializer.text.trim()) throw new Error('Invalid or duplicate key: ' + filename + ':' + key)
    data[key] = prop.initializer.text
  }
  return data
}

export function compareCatalog(source, target) {
  const missing = [], extra = [], invalid = []
  for (const [key, value] of Object.entries(source)) {
    if (!Object.hasOwn(target, key)) missing.push(key)
    else if (typeof target[key] !== 'string' || !target[key].trim() || placeholders(target[key]) !== placeholders(value)) invalid.push(key)
  }
  for (const key of Object.keys(target)) if (!Object.hasOwn(source, key)) extra.push(key)
  return { missing, extra, invalid }
}

function readAll() {
  return Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(modules.map(module => {
    const filename = path.join(root, locale, module + '.ts')
    return [module, parseCatalog(fs.readFileSync(filename, 'utf8'), filename)]
  }))]))
}

function addReviewed(catalogs, filename) {
  const entries = JSON.parse(fs.readFileSync(filename, 'utf8'))
  if (!Array.isArray(entries)) throw new Error('Reviewed input must be an array')
  for (const { module, key, text } of entries) {
    if (!modules.includes(module) || module === 'core' || !keyPattern.test(key) || !key.startsWith(module + '.') || typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 360) throw new Error('Invalid reviewed entry: ' + key)
    const data = catalogs.vi[module]
    if (Object.hasOwn(data,key) && data[key] !== text) throw new Error('Conflicting existing key: ' + key)
    data[key] = text
  }
}

export async function translateMissing(endpoint, token, locale, messages, request = fetch) {
  const result = Object.create(null)
  const entries = Object.entries(messages)
  for (let offset = 0; offset < entries.length; offset += 40) {
    const batch = Object.fromEntries(entries.slice(offset, offset+40))
    const response = await request(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ locale, version: 'static-catalog-v1', messages: batch }),
      signal: AbortSignal.timeout(120000),
    })
    if (!response.ok) throw new Error('Translation failed for ' + locale + ' (HTTP ' + response.status + ')')
    const body = await response.json()
    if (body.locale !== locale || !body.messages || typeof body.messages !== 'object') throw new Error('Invalid translation response for ' + locale)
    const problems = compareCatalog(batch, body.messages)
    if (problems.missing.length || problems.extra.length || problems.invalid.length) throw new Error('Invalid keys or placeholders in translation for ' + locale)
    for (const [key,value] of Object.entries(batch)) {
      if (value === body.messages[key] && viLetters.test(value)) throw new Error('Untranslated value for ' + locale + ':' + key)
      result[key] = body.messages[key]
    }
  }
  return result
}

async function run() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const sync = args.includes('--sync') || apply
  const reviewed = args.indexOf('--from')
  const catalogs = readAll()
  const originals = JSON.stringify(catalogs)
  if (reviewed >= 0) {
    if (!sync || !args[reviewed + 1]) throw new Error('--from requires --sync or --apply and a reviewed JSON file')
    addReviewed(catalogs, args[reviewed + 1])
  }
  let missing = 0
  let bad = 0
  const pending = []
  for (const locale of locales.slice(1)) {
    for (const module of modules) {
      const source = catalogs.vi[module], target = catalogs[locale][module]
      const problems = compareCatalog(source, target)
      if (problems.extra.length || problems.invalid.length) {
        console.error(locale, module, 'invalid/extra:', problems.invalid, problems.extra)
        bad += problems.extra.length + problems.invalid.length
      }
      for (const key of problems.missing) {
        missing++
        pending.push({locale,module,key})
      }
    }
  }
  const keyCount = modules.reduce((n,module) => n+Object.keys(catalogs.vi[module]).length,0)
  console.log(JSON.stringify({ languages: locales, modules: modules.length, keysPerLocale: keyCount, missing, invalid: bad }))
  if (bad || (!sync && missing)) { process.exitCode = 1; return }
  if (!apply) {
    if (missing) console.log(JSON.stringify(pending, null, 2))
    else console.log('PASS: all five catalogs contain the same keys and placeholders')
    return
  }
  if (missing) {
    const origin = process.env.CHATNET_I18N_API_URL
    if (!origin) throw new Error('Set CHATNET_I18N_API_URL to your trusted ChatNet API origin and CHATNET_I18N_TOKEN if authentication is required. No files have been written.')
    const endpoint = new URL('/api/i18n/bundle', origin)
    if (endpoint.username || endpoint.password || (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))) throw new Error('Use HTTPS or a loopback development API')
    for (const locale of locales.slice(1)) {
      for (const module of modules) {
        const source = catalogs.vi[module], target = catalogs[locale][module]
        const absent = compareCatalog(source,target).missing
        if (!absent.length) continue
        // Reuse existing same-module translations where the exact source is identical.
        const remaining = Object.create(null)
        for (const key of absent) {
          const same = Object.keys(source).find(other => other !== key && source[other] === source[key] && Object.hasOwn(target,other))
          if (same) target[key] = target[same]
          else remaining[key] = source[key]
        }
        Object.assign(target, await translateMissing(endpoint, process.env.CHATNET_I18N_TOKEN, locale, remaining))
      }
    }
  }
  // Do not write any catalogue until every requested language is complete.
  for (const locale of locales.slice(1)) for (const module of modules) {
    const errors = compareCatalog(catalogs.vi[module], catalogs[locale][module])
    if (Object.values(errors).some(list => list.length)) throw new Error('Catalogue still incomplete: ' + locale + '/' + module)
  }
  const before = JSON.parse(originals)
  let changed = 0
  for (const locale of locales) for (const module of modules) {
    const data = catalogs[locale][module]
    if (JSON.stringify(data) === JSON.stringify(before[locale][module])) continue
    fs.writeFileSync(path.join(root,locale,module+'.ts'), 'export default ' + JSON.stringify(data,null,2) + ' as const\n')
    changed++
  }
  console.log('PASS: updated ' + changed + ' catalogue files; review the generated translations before commit.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(error => { console.error(error.message); process.exitCode = 1 })
}
