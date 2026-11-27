// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { loadCachedBundle, UI_BUNDLE_MESSAGES, translateUI, formatUnreadMessageDescription, resolveEffectiveLocale, saveAppLocalePreference, loadAppLocalePreference } from './i18n'

describe('built-in UI languages', () => {
  it.each([['vi','Tin nhắn'],['en','Messages'],['zh','消息'],['ja','メッセージ'],['ko','메시지']])('loads %s offline with every key', (locale, label) => {
    const bundle = loadCachedBundle(locale)
    expect(Object.keys(bundle).sort()).toEqual(Object.keys(UI_BUNDLE_MESSAGES).sort())
    expect(bundle['nav.chat']).toBe(label)
    expect(bundle['copy.chat.messages']).toBe(label)
  })

  it('normalizes old preferences and stores only supported languages', () => {
    expect(resolveEffectiveLocale('zh-CN')).toBe('zh')
    expect(resolveEffectiveLocale('fr')).toBe('vi')
    saveAppLocalePreference('ko')
    expect(loadAppLocalePreference()).toBe('ko')
    saveAppLocalePreference('fr')
    expect(loadAppLocalePreference()).toBe('vi')
    localStorage.removeItem('chatnet-app-locale')
  })
  it('loads a complete English bundle without a remote translation or cache', () => {
    const bundle = loadCachedBundle('en')!
    expect(Object.keys(bundle).sort()).toEqual(Object.keys(UI_BUNDLE_MESSAGES).sort())
    expect(translateUI(bundle, 'profile.appLanguage')).toBe('App language')
    expect(translateUI(bundle, 'settings.language')).toBe('Language & AI translation')
    expect(translateUI(bundle, 'nav.chat')).toBe('Messages')
    expect(formatUnreadMessageDescription(3, bundle['nav.chatUnread'])).toBe('3 unread messages')
  })

  it('keeps Vietnamese source and English bundles independent', () => {
    const bundle = loadCachedBundle('en')!
    bundle['nav.chat'] = 'changed'
    expect(loadCachedBundle('en')?.['nav.chat']).toBe('Messages')
    expect(loadCachedBundle('vi')?.['nav.chat']).toBe('Tin nhắn')
  })
})
