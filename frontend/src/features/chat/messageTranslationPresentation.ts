/** Display rules for optional per-message translation.
 * A long message uses a reversible single-text view to avoid doubling the chat height.
 * Short messages show the translation first and retain the original directly below.
 */
import type { ChatTranslationDisplay } from './conversationTranslationSettings'

export const LONG_TRANSLATION_THRESHOLD = 100

export type TranslationView = {
  mode: 'original' | 'dual' | 'translated'
  primaryText: string
  secondaryText: string | null
}

export function getMessageTranslationView({
  originalText,
  translatedText,
  enabled,
  showOriginal = false,
  display = 'adaptive',
}: {
  originalText: string
  translatedText?: string | null
  enabled: boolean
  showOriginal?: boolean
  display?: ChatTranslationDisplay
}): TranslationView {
  const translation = translatedText?.trim() ?? ''
  if (!enabled || !translation || translation === originalText.trim()) {
    return { mode: 'original', primaryText: originalText, secondaryText: null }
  }

  if (display === 'bilingual' || (display === 'adaptive' && Array.from(originalText).length <= LONG_TRANSLATION_THRESHOLD)) {
    return { mode: 'dual', primaryText: translation, secondaryText: originalText }
  }

  return showOriginal
    ? { mode: 'original', primaryText: originalText, secondaryText: null }
    : { mode: 'translated', primaryText: translation, secondaryText: null }
}
