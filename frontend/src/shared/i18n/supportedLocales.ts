// The UI catalogue is intentionally independent of AI message/call translation languages.
export const APP_LOCALES = ['vi', 'en', 'zh', 'ja', 'ko'] as const
export type AppLocale = typeof APP_LOCALES[number]
export const APP_LOCALE_LABELS: Record<AppLocale, string> = {
  vi: 'Tiếng Việt', en: 'English', zh: '简体中文', ja: '日本語', ko: '한국어',
}

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value)
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
  const code = value?.trim().toLowerCase().split('-')[0] ?? ''
  if (isAppLocale(code)) return code
  // Old clients stored "auto". Resolve it once; unsupported device locales fall back to Vietnamese.
  if (!code || code === 'auto') {
    const languages = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language]
    for (const language of languages) {
      const candidate = language?.toLowerCase().split('-')[0] ?? ''
      if (isAppLocale(candidate)) return candidate
    }
  }
  return 'vi'
}

const APP_LOCALE_KEY = 'chatnet-app-locale'

export function loadAppLocalePreference(): AppLocale {
  try { return normalizeAppLocale(localStorage.getItem(APP_LOCALE_KEY)) }
  catch { return normalizeAppLocale(null) }
}

export function saveAppLocalePreference(locale: string) {
  try { localStorage.setItem(APP_LOCALE_KEY, normalizeAppLocale(locale)) }
  catch { /* Storage is optional; app locale remains in React state. */ }
}
