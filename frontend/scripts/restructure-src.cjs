// One-off, reversible source-layout migration. Remove after verification.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const frontend = path.resolve(__dirname, '..')
const src = path.join(frontend, 'src')
const groups = {
  app: ['App.tsx'],
  'features/calls': ['CallManager.tsx', 'calls.ts', 'callCrypto.ts', 'callMediaInterpreter.ts', 'callTranslation.ts', 'call.css'],
  'features/chat': ['GroupActionsSheet.tsx', 'GroupCreator.tsx', 'SharedContent.tsx', 'VoiceRecorder.tsx', 'chatPersistence.ts', 'conversationRead.ts', 'mediaUpload.ts', 'voiceMedia.ts', 'group-actions-sheet.css', 'conversation-content.css'],
  'features/feed': ['FeedDiscussion.tsx', 'FeedModeration.tsx', 'FeedPostActions.tsx', 'feed-actions.css', 'feed-moderation.css'],
  'features/discover': ['NearbyExplorer.tsx', 'nearbyPlaces.ts', 'geolocation.ts', 'nearby-explorer.css'],
  'features/profile': ['ProfileQr.tsx'],
  'features/notifications': ['onesignal.ts', 'incomingSound.ts', 'notifications.css'],
  'features/auth': ['session.ts'],
  'features/i18n': ['i18n.ts', 'languages.ts'],
  'features/pwa': ['PWAUpdate.tsx', 'pwa-updates.ts'],
  'shared/ui': ['SocoUI.tsx'],
  'shared/lib': ['optimistic.ts'],
  styles: ['styles.css', 'mobile.css', 'mobile-nav.css', 'friends.css', 'zalo-inspired.css', 'soco-theme.css', 'soco-screens.css', 'soco-layout-v2.css', 'connection-tools.css'],
}

const mapping = new Map()
for (const [dir, files] of Object.entries(groups)) {
  for (const file of files) {
    assert(!mapping.has(file), 'Duplicate source: ' + file)
    mapping.set(file, path.join(src, dir, file))
  }
}
const roots = fs.readdirSync(src, { withFileTypes: true }).filter((item) => item.isFile()).map((item) => item.name)
const left = roots.filter((name) => !mapping.has(name)).sort()
assert.deepEqual(left, ['main.tsx', 'vite-env.d.ts'], 'Unhandled top-level src files')
if (process.argv.includes('--fix-extensions')) {
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) { visit(file); continue }
      if (!/\.tsx?$/.test(file)) continue
      const before = fs.readFileSync(file, 'utf8')
      const after = before.replace(/(['"])(\.\.?\/[^'"\r\n]+?)\.tsx?\1/g, (_full, quote, spec) => quote + spec + quote)
      if (after !== before) fs.writeFileSync(file, after)
    }
  }
  visit(src)
  console.log('Restored extensionless TypeScript module imports.')
  process.exit(0)
}
const originals = new Map()
for (const [name, destination] of mapping) {
  const original = path.join(src, name)
  assert(fs.existsSync(original), 'Missing original: ' + name)
  assert(!fs.existsSync(destination), 'Destination already exists: ' + destination)
  originals.set(original, fs.readFileSync(original))
}
const scriptsDir = path.join(frontend, 'scripts')
const scripts = fs.readdirSync(scriptsDir).filter((file) => /\.(?:mjs|js|cjs)$/.test(file)).map((file) => path.join(scriptsDir, file))
const unchangedRoots = left.map((name) => path.join(src, name))
const entries = [...originals.keys(), ...unchangedRoots, ...scripts]
const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.svg', '/index.ts', '/index.tsx']
function findOriginal(absolute) {
  return extensions.map((extension) => absolute + extension).find((file) => fs.existsSync(file) && fs.statSync(file).isFile())
}
function relativeFrom(from, to) {
  const relative = path.relative(path.dirname(from), to).split(path.sep).join('/')
  return relative.startsWith('.') ? relative : './' + relative
}
function rewrite(content, oldFile, newFile) {
  let result = content.replace(/(['"])(\.\.?\/[^'"\r\n]+)\1/g, (full, quote, spec) => {
    const match = /^([^?#]*)([?#].*)?$/.exec(spec)
    const originalTarget = findOriginal(path.resolve(path.dirname(oldFile), match[1]))
    if (!originalTarget) return full
    const updatedTarget = mapping.get(path.basename(originalTarget)) && path.dirname(originalTarget) === src
      ? mapping.get(path.basename(originalTarget)) : originalTarget
    const updated = relativeFrom(newFile, updatedTarget) + (match[2] || '')
    return quote + updated + quote
  })
  // Some smoke tests read source files relative to the frontend project root.
  if (oldFile.startsWith(scriptsDir + path.sep)) {
    result = result.replace(/(['"])src\/([^'"\r\n]+)\1/g, (full, quote, spec) => {
      const match = /^([^?#]*)([?#].*)?$/.exec(spec)
      const destination = mapping.get(match[1])
      return destination ? quote + 'src/' + path.relative(src, destination).split(path.sep).join('/') + (match[2] || '') + quote : full
    })
  }
  return result
}
const targetContent = new Map()
for (const file of entries) {
  const destination = originals.has(file) ? mapping.get(path.basename(file)) : file
  const input = originals.get(file) || fs.readFileSync(file)
  const rewritten = rewrite(input.toString('utf8'), file, destination)
  if (destination !== file || rewritten !== input.toString('utf8')) targetContent.set(file, { destination, bytes: Buffer.from(rewritten) })
}
console.log('Migration:', mapping.size, 'source moves,', [...targetContent].filter(([old, next]) => old === next.destination).length, 'other files updated')
console.log([...mapping].map(([from, to]) => '  ' + from + ' -> ' + path.relative(src, to)).join('\n'))
if (!process.argv.includes('--apply')) {
  console.log('Dry run only. Pass --apply to change files.')
  process.exit(0)
}
const backup = new Map([...targetContent.keys()].map((file) => [file, fs.readFileSync(file)]))
try {
  for (const { destination, bytes } of targetContent.values()) {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, bytes)
  }
  for (const [oldFile, { destination }] of targetContent) if (oldFile !== destination) fs.unlinkSync(oldFile)
  for (const [oldFile, { destination, bytes }] of targetContent) {
    assert(fs.readFileSync(destination).equals(bytes), 'Verification failed: ' + destination)
    if (oldFile !== destination) assert(!fs.existsSync(oldFile), 'Original not removed: ' + oldFile)
  }
  console.log('Applied and content-verified.')
} catch (error) {
  for (const [original, bytes] of backup) {
    fs.mkdirSync(path.dirname(original), { recursive: true })
    fs.writeFileSync(original, bytes)
  }
  for (const [oldFile, { destination }] of targetContent) if (oldFile !== destination && fs.existsSync(destination)) fs.unlinkSync(destination)
  throw error
}
