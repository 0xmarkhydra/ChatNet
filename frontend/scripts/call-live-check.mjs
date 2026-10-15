import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const read = (file) => readFileSync(new URL(file, root), 'utf8')
const ui = read('src/CallManager.tsx')
const transport = read('src/callMediaInterpreter.ts')
const backend = read('../backend/cmd/call/translation.go')
const secrets = ['GEMINI_API_KEY', 'generativelanguage.googleapis.com', 'auth_tokens', 'BidiGenerateContent', 'liveConnectConstraints', 'gemini-3.5-live']
for (const source of [ui, transport]) {
  for (const secret of secrets) assert.equal(source.includes(secret), false, 'client must not have provider detail: ' + secret)
}
assert.equal(ui.includes('type="checkbox"'), false, 'translation must not require checkboxes')
assert.ok(ui.includes('Dịch AI'), 'call translation toggle must exist')
assert.ok(transport.includes('/translation-session') && transport.includes('/translation-stream'))
assert.ok(backend.includes('GEMINI_API_KEY') && backend.includes('connectGeminiLive'))
assert.ok(backend.includes('GetDel('), 'one-time tickets must be consumed once')
console.log('PASS: browser contains no Gemini provider keys, model, URL or config, one-click translation UI')
