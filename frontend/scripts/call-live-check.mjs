import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const read = (file) => readFileSync(new URL(file, root), 'utf8')
const ui = read('src/CallManager.tsx')
const transport = read('src/callMediaInterpreter.ts')
const backend = read('../backend/cmd/call/translation.go')
const callRoutes = read('../backend/cmd/call/main.go')
const secrets = ['GEMINI_API_KEY', 'generativelanguage.googleapis.com', 'auth_tokens', 'BidiGenerateContent', 'liveConnectConstraints', 'gemini-3.5-live']
for (const source of [ui, transport]) {
  for (const secret of secrets) assert.equal(source.includes(secret), false, 'client must not have provider detail: ' + secret)
}
assert.equal(ui.includes('type="checkbox"'), false, 'translation must not require checkboxes')
assert.ok(ui.includes('Dịch AI'), 'call translation toggle must exist')
assert.ok(transport.includes('/translation-session') && transport.includes('/translation-stream'))
assert.ok(backend.includes('GEMINI_API_KEY') && backend.includes('connectGeminiLive'))
assert.ok(backend.includes('GetDel('), 'one-time tickets must be consumed once')
assert.ok(ui.includes('/translation-consent') && ui.includes('updateVoiceConsent('), 'speaker consent must persist through authenticated API')
assert.ok(callRoutes.includes('POST /api/calls/{id}/translation-consent') &&
  callRoutes.includes('GET /api/calls/{id}/translation-consent'), 'authenticated consent routes must be registered')
assert.ok(callRoutes.includes('joinedCallParticipant(') &&
  callRoutes.includes('joinedCallUserIDs('), 'E2EE key access must require joined call membership')
assert.ok(callRoutes.includes('removeLiveKitParticipant(ctx, call.RoomName, claims.UserID)'),
  'group departure must kick participant from LiveKit media')
assert.ok(ui.includes("phase !== 'connected'") &&
  ui.includes('[room, phase, translationOn,'), 'AI media streaming must stop on LiveKit reconnect/disconnect')
assert.ok(backend.includes('callTranslationConsentAllowed(') && backend.includes('speaker has not consented to AI translation'), 'Gemini tickets require server-verified speaker consent')
assert.ok(backend.includes('consentErr != nil || !consented'), 'AI streams must terminate after consent is revoked')
console.log('PASS: provider secrets stay on backend; one-click UI; server-verified per-call consent')
