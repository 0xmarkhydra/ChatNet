export const UI_BUNDLE_VERSION = '2026-10-04.1'

export const UI_MESSAGES = {
  'nav.chat': 'Tin nhắn',
  'nav.contacts': 'Danh bạ',
  'nav.discover': 'Quanh đây',
  'nav.feed': 'Bảng tin',
  'nav.profile': 'Cá nhân',

  'common.search': 'Tìm kiếm',
  'common.save': 'Lưu thay đổi',
  'common.saving': 'Đang lưu...',
  'common.close': 'Đóng',
  'common.auto': 'Tự động',
  'common.loading': 'Đang tải...',
  'common.test': 'Test',

  'profile.tagline': 'Kết nối không biên giới',
  'profile.addCover': 'Thêm ảnh bìa',
  'profile.changeCover': 'Đổi ảnh bìa',
  'profile.changeAvatar': 'Đổi ảnh đại diện',
  'profile.avatarHint': 'Bấm biểu tượng máy ảnh để đổi avatar',
  'profile.avatarUpdating': 'Đang cập nhật ảnh đại diện...',
  'profile.personalInfo': 'Thông tin cá nhân',
  'profile.personalInfoHint': 'Đổi tên hiển thị và username của bạn',
  'profile.displayName': 'Tên hiển thị',
  'profile.displayNamePlaceholder': 'Tên của bạn',
  'profile.username': 'Username',
  'profile.usernameHint': '3–32 ký tự: chữ thường, số, dấu chấm, _ hoặc -',
  'profile.notifications': 'Thông báo',
  'profile.notificationsHint': 'Cho phép bật/tắt bất cứ lúc nào',
  'profile.testNotification': 'Test thông báo',
  'profile.testNotificationHint': 'Bắn một push thử tới thiết bị này',
  'profile.autoTranslate': 'Tự động dịch tin nhắn',
  'profile.translationLanguage': 'Ngôn ngữ dịch',
  'profile.translationLanguageHint': 'Giữ nguyên sau khi F5/mở lại app',
  'profile.appLanguage': 'Ngôn ngữ ứng dụng',
  'profile.appLanguageHint': 'Tự động theo thiết bị hoặc chọn ngôn ngữ riêng',
  'profile.install': 'Cài ChatNet vào điện thoại',
  'profile.logout': 'Đăng xuất',

  'locale.title': 'Ngôn ngữ ứng dụng',
  'locale.subtitle': 'Giao diện ChatNet sẽ dùng ngôn ngữ này',
  'locale.device': 'Theo ngôn ngữ thiết bị',
  'locale.deviceHint': 'Tự nhận diện ngôn ngữ của điện thoại hoặc trình duyệt',
  'locale.searchPlaceholder': 'Tìm ngôn ngữ, quốc gia hoặc mã...',
  'locale.noResults': 'Không tìm thấy ngôn ngữ phù hợp',
  'locale.dynamicHint': 'Bản dịch giao diện được tải và cache tự động',

  'translation.title': 'Dịch AI',
  'translation.subtitle': 'Dịch tự động tin nhắn nhận được',
  'translation.searchPlaceholder': 'Tìm ngôn ngữ, quốc gia hoặc mã...',
  'translation.languageCount': 'ngôn ngữ',
  'translation.languageHint': 'Tên theo ngôn ngữ giao diện + tên bản địa',
  'translation.noResults': 'Không tìm thấy ngôn ngữ phù hợp.',
  'translation.original': 'GỐC',
  'translation.originalText': 'Nguyên văn',
} as const

export type UIMessageKey = keyof typeof UI_MESSAGES
export type UIBundle = Record<UIMessageKey, string>

const APP_LOCALE_KEY = 'chatnet-app-locale'
const BUNDLE_PREFIX = 'chatnet-ui-bundle:'

export function defaultBundle(): UIBundle {
  return { ...UI_MESSAGES }
}

export function loadAppLocalePreference() {
  const stored = localStorage.getItem(APP_LOCALE_KEY)?.trim().toLowerCase()
  return stored || 'auto'
}

export function saveAppLocalePreference(locale: string) {
  localStorage.setItem(APP_LOCALE_KEY, locale)
}

export function resolveDeviceLocale(valid: (code: string) => boolean) {
  const candidates = [...(navigator.languages || []), navigator.language]
  for (const candidate of candidates) {
    const code = candidate?.toLowerCase().split('-')[0]
    if (code && valid(code)) return code
  }
  return 'vi'
}

export function resolveEffectiveLocale(preference: string, valid: (code: string) => boolean) {
  const normalized = preference.toLowerCase().split('-')[0]
  if (normalized !== 'auto' && valid(normalized)) return normalized
  return resolveDeviceLocale(valid)
}

export function bundleCacheKey(locale: string) {
  return `${BUNDLE_PREFIX}${UI_BUNDLE_VERSION}:${locale}`
}

export function loadCachedBundle(locale: string): UIBundle | null {
  if (locale === 'vi') return defaultBundle()
  try {
    const raw = localStorage.getItem(bundleCacheKey(locale))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UIBundle>
    const bundle = defaultBundle()
    for (const key of Object.keys(bundle) as UIMessageKey[]) {
      const value = parsed[key]
      if (typeof value === 'string' && value.trim()) bundle[key] = value
    }
    return bundle
  } catch {
    return null
  }
}

export function saveCachedBundle(locale: string, bundle: UIBundle) {
  if (locale === 'vi') return
  try {
    localStorage.setItem(bundleCacheKey(locale), JSON.stringify(bundle))
  } catch {
    // Storage can be unavailable in private browsing; in-memory bundle still works.
  }
}

export function translateUI(bundle: UIBundle, key: UIMessageKey) {
  return bundle[key] || UI_MESSAGES[key]
}
