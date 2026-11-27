// Public localization type contracts for consumers outside the i18n feature.
export type { UIMessageKey } from './lib/i18n'
export type { LanguageOption } from './utils/languages'
export { UI_MESSAGES, loadAppLocalePreference, saveAppLocalePreference } from './lib/i18n'
export { isAppLocale, normalizeAppLocale } from '../../shared/i18n/supportedLocales'
export { buildAppLanguageOptions, buildLanguageOptions, filterLanguageOptions, isSupportedLanguageCode } from './utils/languages'
