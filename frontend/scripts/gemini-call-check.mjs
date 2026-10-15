import assert from 'node:assert/strict'
import { GEMINI_LIVE_LANGUAGES, normalizeGeminiLanguage } from '../src/geminiLanguages.ts'
assert.ok(GEMINI_LIVE_LANGUAGES.length >= 70)
for (const code of ['vi', 'en', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'pt-BR', 'pt-PT', 'fil']) {
  assert.ok(GEMINI_LIVE_LANGUAGES.includes(code))
  assert.equal(normalizeGeminiLanguage(code), code)
}
assert.equal(normalizeGeminiLanguage('vi-VN'), 'vi')
assert.equal(normalizeGeminiLanguage('pt'), 'pt-BR')
assert.equal(normalizeGeminiLanguage('zh'), 'zh-Hans')
assert.equal(normalizeGeminiLanguage('tl'), 'fil')
assert.equal(normalizeGeminiLanguage('invalid-source'), 'en')
console.log('PASS: Gemini Live translation languages and fallback codes')
