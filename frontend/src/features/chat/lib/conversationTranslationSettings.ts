import { isSupportedLanguageCode } from '../../i18n/utils/languages'

export type ChatTranslationDisplay = 'adaptive' | 'bilingual' | 'translated'

export type ChatTranslationSettings = {
  enabled: boolean
  targetLanguage: string
  sourceLanguage: string
  display: ChatTranslationDisplay
}
export type ConversationTranslationSettingsMap = Record<number, ChatTranslationSettings>

function validConfig(value: unknown): value is ChatTranslationSettings {
  if (!value || typeof value !== 'object') return false
  const setting = value as Record<string, unknown>
  return typeof setting.enabled === 'boolean' &&
    typeof setting.targetLanguage === 'string' && isSupportedLanguageCode(setting.targetLanguage) &&
    typeof setting.sourceLanguage === 'string' && isSupportedLanguageCode(setting.sourceLanguage) &&
    (setting.display === 'adaptive' || setting.display === 'bilingual' || setting.display === 'translated')
}

const settingsKey = (userId: number) => `chatnet-conversation-translations:${userId}`

export function readConversationTranslationSettings(userId: number): ConversationTranslationSettingsMap {
  try {
    const stored = localStorage.getItem(settingsKey(userId))
    if (!stored) return {}
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([id, value]) =>
      Number.isSafeInteger(Number(id)) && Number(id) > 0 && validConfig(value)))
  } catch {
    return {}
  }
}

export function persistConversationTranslationSettings(
  userId: number, settings: ConversationTranslationSettingsMap,
) {
  try {
    localStorage.setItem(settingsKey(userId), JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
