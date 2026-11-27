import coreVi from '../../../shared/i18n/locales/vi/core'
import coreEn from '../../../shared/i18n/locales/en/core'
import coreZh from '../../../shared/i18n/locales/zh/core'
import coreJa from '../../../shared/i18n/locales/ja/core'
import coreKo from '../../../shared/i18n/locales/ko/core'
import { getCopyBundle, sourceCopyBundle, type CopyBundleKey } from '../../../shared/i18n/locale'
import { normalizeAppLocale, type AppLocale } from '../../../shared/i18n/supportedLocales'

export const UI_BUNDLE_VERSION = '2026-11-27.4'
export const UI_MESSAGES = coreVi
export const UI_BUNDLE_MESSAGES = { ...UI_MESSAGES, ...sourceCopyBundle }

export type UIMessageKey = keyof typeof coreVi
export type UIBundleKey = UIMessageKey | CopyBundleKey
export type UIBundle = Record<UIBundleKey, string>
const coreDictionaries: Record<AppLocale, Record<UIMessageKey, string>> = { vi: coreVi, en: coreEn, zh: coreZh, ja: coreJa, ko: coreKo }
export { loadAppLocalePreference, saveAppLocalePreference } from '../../../shared/i18n/supportedLocales'

export function resolveEffectiveLocale(preference: string, _valid?: (code: string) => boolean): AppLocale {
  return normalizeAppLocale(preference)
}

// All five supported languages are shipped with the frontend; no runtime translation or cache miss.
export function loadCachedBundle(locale: string): UIBundle {
  const code = normalizeAppLocale(locale)
  return { ...coreDictionaries[code], ...getCopyBundle(code) }
}

export function defaultBundle(): UIBundle {
  return loadCachedBundle('vi')
}

export function translateUI(bundle: UIBundle, key: UIMessageKey) {
  return bundle[key] || UI_MESSAGES[key]
}

export function formatUnreadMessageDescription(count: number, template: string = UI_MESSAGES['nav.chatUnread']) {
  const message = template.includes('{count}') ? template : UI_MESSAGES['nav.chatUnread']
  return message.replace('{count}', String(count))
}