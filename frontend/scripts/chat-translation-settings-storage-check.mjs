import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/features/chat/lib/conversationTranslationSettings.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm',
})
const { readConversationTranslationSettings, persistConversationTranslationSettings } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'))

const entries = new Map()
globalThis.localStorage = {
  getItem: key => entries.get(key) ?? null,
  setItem: (key, value) => { entries.set(key, value) },
}
assert.deepEqual(readConversationTranslationSettings(4), {})
const alice = { 101: { enabled:true,targetLanguage:'vi',sourceLanguage:'en',display:'adaptive' } }
const bob = { 101: { enabled:false,targetLanguage:'en',sourceLanguage:'vi',display:'translated' } }
assert.equal(persistConversationTranslationSettings(4,alice),true)
assert.equal(persistConversationTranslationSettings(5,bob),true)
assert.deepEqual(readConversationTranslationSettings(4),alice)
assert.deepEqual(readConversationTranslationSettings(5),bob)
assert.deepEqual(readConversationTranslationSettings(6),{})
entries.set('chatnet-conversation-translations:4', '{"0":{"enabled":true,"targetLanguage":"vi","sourceLanguage":"en","display":"adaptive"},"101":{"enabled":true,"targetLanguage":"vi","sourceLanguage":"en","display":"adaptive"},"102":{"enabled":true,"targetLanguage":"unsupported","sourceLanguage":"en","display":"bilingual"}}')
assert.deepEqual(readConversationTranslationSettings(4),alice, 'Ignore invalid conversation IDs and unsupported languages')
entries.set('chatnet-conversation-translations:4','{not JSON')
assert.deepEqual(readConversationTranslationSettings(4),{}, 'Corrupt storage must not crash the app')
globalThis.localStorage.setItem = () => { throw new Error('quota') }
assert.equal(persistConversationTranslationSettings(4,alice),false, 'Storage errors must be reported')
console.log('PASS: per-user/per-conversation persistence, validation and unavailable storage')
