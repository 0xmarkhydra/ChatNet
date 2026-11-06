import assert from 'node:assert/strict'
import {
  getMessageTranslationView,
  LONG_TRANSLATION_THRESHOLD,
} from '../src/features/chat/messageTranslationPresentation.ts'

assert.equal(LONG_TRANSLATION_THRESHOLD, 100)
for (const length of [1, 99, 100]) {
  const originalText = 'a'.repeat(length)
  assert.deepEqual(getMessageTranslationView({
    originalText, translatedText: 'Bản dịch mẫu', enabled: true,
  }), { mode: 'dual', primaryText: 'Bản dịch mẫu', secondaryText: originalText })
}
const longText = 'b'.repeat(101)
assert.deepEqual(getMessageTranslationView({
  originalText: longText, translatedText: 'Text translated', enabled: true,
}), { mode: 'translated', primaryText: 'Text translated', secondaryText: null })
assert.deepEqual(getMessageTranslationView({
  originalText: longText, translatedText: 'Text translated', enabled: true, showOriginal: true,
}), { mode: 'original', primaryText: longText, secondaryText: null })
assert.deepEqual(getMessageTranslationView({
  originalText: longText, translatedText: 'Text translated', enabled: false,
}), { mode: 'original', primaryText: longText, secondaryText: null })
assert.deepEqual(getMessageTranslationView({
  originalText: longText, translatedText: null, enabled: true,
}), { mode: 'original', primaryText: longText, secondaryText: null })
assert.equal(getMessageTranslationView({
  originalText: '🤍'.repeat(100), translatedText: 'White hearts', enabled: true,
}).mode, 'dual', 'Use Unicode characters rather than UTF-16 code units')
assert.equal(getMessageTranslationView({
  originalText: '🤍'.repeat(101), translatedText: 'White hearts', enabled: true,
}).mode, 'translated')
assert.equal(getMessageTranslationView({
  originalText: 'hi', translatedText: 'hi', enabled: true,
}).mode, 'original', 'Do not show a meaningless duplicate translation')
console.log('PASS: 99, 100, 101 characters, original/translated switch, off, unchanged and Unicode')
