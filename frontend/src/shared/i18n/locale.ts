import { createContext, useContext, useMemo } from 'react'
import vi from './locales/vi'
import en from './locales/en'
import zh from './locales/zh'
import ja from './locales/ja'
import ko from './locales/ko'
import { normalizeAppLocale, type AppLocale } from './supportedLocales'

export type UiCopyKey = keyof typeof vi
type Values = Record<string, string | number>
type Dictionary = Record<UiCopyKey, string>
export type CopyBundleKey = `copy.${UiCopyKey}`
export type CopyBundle = Partial<Record<CopyBundleKey, string>>
function prefixBundle(dictionary: Dictionary): Record<CopyBundleKey, string> {
  return Object.fromEntries(Object.entries(dictionary).map(([key, text]) => [`copy.${key}`, text])) as Record<CopyBundleKey, string>
}
export const sourceCopyBundle = prefixBundle(vi)
export const englishCopyBundle = prefixBundle(en)
const dictionaries: Record<AppLocale, Dictionary> = { vi, en, zh, ja, ko }

export function getCopyBundle(locale: string) {
  return prefixBundle(dictionaries[normalizeAppLocale(locale)])
}

export function resolveUiCopyLocale(locale: string) {
  return normalizeAppLocale(locale)
}

export function createUiTranslator(locale: string, bundle?: CopyBundle) {
  const dictionary = dictionaries[resolveUiCopyLocale(locale)] ?? vi
  return (key: UiCopyKey, values?: Values): string => {
    const category = typeof values?.count === 'number' ? new Intl.PluralRules(resolveUiCopyLocale(locale)).select(values.count) : null
    const variant = category ? `${key}.${category}` as UiCopyKey : key
    const selected = Object.hasOwn(dictionary, variant) ? variant : key
    const template = bundle?.[`copy.${selected}`] || dictionary[selected] || vi[selected]
    return values ? template.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? (typeof values[name] === 'number' ? new Intl.NumberFormat(resolveUiCopyLocale(locale)).format(values[name] as number) : String(values[name])) : match) : template
  }
}

// Only reviewed system toasts are matched. Unknown server errors and user text remain unchanged.
const systemNoticeKeys = new Map<string, UiCopyKey>(
  (Object.entries(vi) as [UiCopyKey, string][])
    .filter(([key]) => key.startsWith('notifications.system.'))
    .map(([key, value]) => [value, key]),
)

export function translateSystemNotice(message: string, t: ReturnType<typeof createUiTranslator>) {
  const key = systemNoticeKeys.get(message)
  if (key) return t(key)
  // Only known system-message shapes; dynamic data is inserted verbatim.
  const sent = /^Đã gửi thông báo test tới (\d+) thiết bị\.$/u.exec(message)
  if (sent) return t('notifications.system.pushTestSent', { count: Number(sent[1]) })
  const init = /^Không khởi tạo được Push Notification: ([\s\S]+)$/u.exec(message)
  if (init) return t('notifications.system.pushInitFailed', { detail: init[1] })
  const shared = /^Đã gửi bài viết đến ([\s\S]+)\.$/u.exec(message)
  if (shared) return t('notifications.system.postShared', { name: shared[1] })
  return message
}

export const UiLocaleContext = createContext<{ locale: string; bundle?: CopyBundle }>({ locale: 'vi' })

export function useUiTranslation() {
  const { locale, bundle } = useContext(UiLocaleContext)
  return useMemo(() => createUiTranslator(locale, bundle), [locale, bundle])
}

export function useUiLocale() {
  return useContext(UiLocaleContext).locale
}

export function formatUiDate(value: Date | string | number, locale: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(resolveUiCopyLocale(locale), options).format(date)
}

export function formatUiNumber(value: number, locale: string, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(resolveUiCopyLocale(locale), options).format(value)
}

export function formatUiRelativeTime(value: string, locale: string, justNow: string, now = Date.now(), absoluteAfterDays = 7) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return ''
  const minutes = Math.max(0, Math.floor((now - parsed) / 60000))
  if (minutes < 1) return justNow
  const formatter = new Intl.RelativeTimeFormat(resolveUiCopyLocale(locale), { numeric: 'always' })
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  if (minutes < 1440) return formatter.format(-Math.floor(minutes / 60), 'hour')
  if (minutes < absoluteAfterDays * 1440) return formatter.format(-Math.floor(minutes / 1440), 'day')
  return formatUiDate(parsed, locale, { year: 'numeric', month: 'numeric', day: 'numeric' })
}
