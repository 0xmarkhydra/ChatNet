// One-time, exact-match migration of reviewed UI phrases. Never translate arbitrary data.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const catalogDir = path.join(root, 'shared/i18n/locales/vi')
const catalogs = Object.fromEntries(fs.readdirSync(catalogDir).filter(f => !['index.ts', 'core.ts'].includes(f)).map(f => [f.slice(0,-3), JSON.parse(fs.readFileSync(path.join(catalogDir, f), 'utf8').replace(/^export default /, '').replace(/ as const\s*$/, ''))]))
const attrs = new Set(['aria-label', 'aria-description', 'placeholder', 'title', 'alt', 'label', 'description', 'emptyLabel', 'hint', 'message', 'data-tooltip', 'tooltip', 'ariaLabel'])
const all = Object.assign({}, ...Object.values(catalogs))
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    const f=path.join(dir,e.name)
    return e.isDirectory() ? walk(f) : e.name.endsWith('.tsx') && !/\.(test|spec)\./.test(e.name) ? [f] : []
  })
}
function component(node, tree) {
  for(let n=node.parent;n && n!==tree;n=n.parent) {
    if(ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text) && n.parent===tree && n.body) return n
    if((ts.isArrowFunction(n)||ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent) && /^[A-Z]/.test(n.parent.name.getText(tree)) && ts.isBlock(n.body) && n.parent.parent.parent.parent===tree) return n
  }
}
const report={}
const candidates = new Map()
const extract = process.argv.includes('--extract')
const viLetters = /[ăâđêôơưĂÂĐÊÔƠƯ\u1ea0-\u1ef9àáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/u
let total=0,files=0
for(const file of walk(root)) {
  const rel=path.relative(root,file).replaceAll('\\','/')
  if(rel.includes('/i18n/') || rel==='app/AuthedApp.tsx') continue
  const source=fs.readFileSync(file,'utf8')
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const parts=rel.split('/')
  const module=parts[0]==='features'?parts[1]:parts[0]
  const prefer={...all,...catalogs.common,...catalogs[module]}
  const lookup=new Map(Object.entries(prefer).map(([k,v])=>[v,k]))
  // Explicit module preference independent of object insertion order.
  for(const [k,v] of Object.entries(catalogs.common)) lookup.set(v,k)
  for(const [k,v] of Object.entries(catalogs[module]||{})) lookup.set(v,k)
  const changes=[], owners=new Set()
  const isAuth=rel==='features/auth/components/AuthScreen.tsx'
  function add(node,value,kind,args) {
    const text=value.replace(/\s+/g,' ').trim().replaceAll('&amp;','&')
    const key=lookup.get(text)
    const owner=component(node,tree)
    if(!owner) return
    if (!key && extract && viLetters.test(text) && Buffer.byteLength(text) <= 360 && !/[{}]/.test(text)) {
      const namespace = Object.hasOwn(catalogs,module) ? module : 'common'
      const id = namespace + '.auto_' + createHash('sha256').update(text).digest('hex').slice(0,16)
      const candidate = candidates.get(id) || { module: namespace, key: id, text, locations: [] }
      candidate.locations.push(rel + ':' + (tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1))
      candidates.set(id,candidate)
    }
    if(!key || text.includes('{count}') || text.includes('{time}')) return
    let start=node.getStart(tree), end=node.end, replacement
    const call="trUi("+JSON.stringify(key)+(args?.length ? ', { '+args.map((arg,i)=>'v'+(i+1)+': String('+arg+')').join(', ')+' }' : '')+")"
    if(kind==='jsxtext') {
      start=node.pos
      // Preserve meaningful spaces next to other inline elements.
      const leading=/^[ \t]+/.test(value) && !/^[ \t]*\r?\n/.test(value)
      const trailing=/[ \t]+$/.test(value) && !/\r?\n[ \t]*$/.test(value)
      replacement='{'+(leading?"' ' + ":'')+call+(trailing?" + ' '":'')+'}'
    } else if(kind==='attr') replacement='{'+call+'}'
    else replacement=call
    changes.push({start,end,replacement})
    owners.add(owner)
  }
  function expr(node, allowTemplates = false) {
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)) add(node,node.text,'expression')
    else if(allowTemplates && ts.isTemplateExpression(node)) {
      const template = node.head.text + node.templateSpans.map((span,i)=>'{v'+(i+1)+'}'+span.literal.text).join('')
      add(node,template,'expression',node.templateSpans.map(span=>span.expression.getText(tree)))
    }
    else if(ts.isConditionalExpression(node)) {expr(node.whenTrue, allowTemplates);expr(node.whenFalse, allowTemplates)}
    else if(ts.isParenthesizedExpression(node)) expr(node.expression, allowTemplates)
    else if(ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) expr(node.right, allowTemplates)
  }
  function visit(node) {
    if(ts.isJsxText(node)) add(node,node.getText(tree),'jsxtext')
    if(ts.isJsxAttribute(node) && attrs.has(node.name.getText(tree)) && node.initializer) {
      const init=node.initializer
      if(ts.isStringLiteral(init)) add(init,init.text,'attr')
      else if(ts.isJsxExpression(init)&&init.expression) expr(init.expression, true)
    } else if(ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) expr(node.expression)
    ts.forEachChild(node,visit)
  }
  visit(tree)
  if(!changes.length) continue
  const count=changes.length
  if(!isAuth) {
    let needsHook = false
    for(const owner of owners) {
      if (owner.body.statements.some(stmt => ts.isVariableStatement(stmt) && stmt.declarationList.declarations.some(d => d.name.getText(tree) === 'trUi'))) continue
      needsHook = true
      changes.push({start:owner.body.getStart(tree)+1,end:owner.body.getStart(tree)+1,replacement:'\n  const trUi = useUiTranslation()\n'})
    }
    // Insert after directives (if any), before the first import.
    const first=tree.statements.find(ts.isImportDeclaration)
    if(!first) continue
    if(needsHook && !tree.statements.some(stmt => ts.isImportDeclaration(stmt) && stmt.getText(tree).includes('useUiTranslation'))) changes.push({start:first.getStart(tree),end:first.getStart(tree),replacement:"import { useUiTranslation } from '@/shared/i18n/locale'\n"})
  }
  let updated=source
  for(const c of changes.sort((a,b)=>b.start-a.start)) updated=updated.slice(0,c.start)+c.replacement+updated.slice(c.end)
  const parsed=ts.createSourceFile(file,updated,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  if(parsed.parseDiagnostics.length) throw new Error('Invalid migration: '+rel)
  report[module]=(report[module]||0)+count;total+=count;files++
  if(!extract && process.argv.includes('--apply')) fs.writeFileSync(file,updated)
}
if(extract) console.log(JSON.stringify([...candidates.values()].sort((a,b)=>a.key.localeCompare(b.key)),null,2))
else console.log(JSON.stringify({files,total,modules:report,applied:process.argv.includes('--apply')}))