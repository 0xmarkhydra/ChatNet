// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createUiTranslator, formatUiDate, formatUiNumber, formatUiRelativeTime, translateSystemNotice, UiLocaleContext, useUiTranslation } from './locale'

describe('shared i18n', () => {
  it('formats elapsed time in the selected locale and handles old or invalid dates', () => {
    const now = Date.parse('2026-11-27T09:00:00Z')
    expect(formatUiRelativeTime('2026-11-27T08:59:30Z', 'en', 'Just now', now)).toBe('Just now')
    expect(formatUiRelativeTime('2026-11-27T08:59:00Z', 'en', 'Just now', now)).toBe('1 minute ago')
    expect(formatUiRelativeTime('2026-11-26T09:00:00Z', 'en', 'Just now', now)).toBe('1 day ago')
    expect(formatUiRelativeTime('2026-11-01T00:00:00Z', 'en', 'Just now', now)).toBe(formatUiDate('2026-11-01T00:00:00Z', 'en', {year:'numeric',month:'numeric',day:'numeric'}))
    expect(formatUiRelativeTime('invalid', 'en', 'Just now', now)).toBe('')
  })

  it('formats counts and dates for the selected locale', () => {
    expect(createUiTranslator('en')('common.countMembers', { count: 1 })).toBe('1 member')
    expect(createUiTranslator('en')('common.countMembers', { count: 1200 })).toBe('1,200 members')
    expect(createUiTranslator('vi')('common.countMembers', { count: 1200 })).toBe('1.200 thành viên')
    expect(formatUiNumber(1234.5, 'en')).toBe('1,234.5')
    expect(formatUiDate('2026-11-27T10:00:00Z', 'en', { month: 'long', timeZone: 'UTC' })).toBe('November')
    expect(formatUiDate('invalid', 'vi', { day: 'numeric' })).toBe('')
    expect(createUiTranslator('ja', { 'copy.chat.messages': 'メッセージ' })('chat.messages')).toBe('メッセージ')
  })

  it('translates shared dynamic notices without modifying names or unknown details', () => {
    const t = createUiTranslator('en')
    expect(translateSystemNotice('Đã gửi bài viết đến Gia đình.', t)).toBe('Post sent to Gia đình.')
    expect(translateSystemNotice('Đã gửi thông báo test tới 2 thiết bị.', t)).toBe('Test notification sent to 2 devices.')
    expect(translateSystemNotice('Không khởi tạo được Push Notification: lỗi thiết bị', t)).toBe('Could not initialize push notifications: lỗi thiết bị')
    expect(translateSystemNotice('Nội dung người dùng', t)).toBe('Nội dung người dùng')
  })

  it('changes text across components without remounting or translating user content', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const host = document.createElement('div')
    const root = createRoot(host)
    function Child() {
      const t = useUiTranslation()
      const [draft, setDraft] = useState('Tin nhắn do người dùng nhập')
      return <><button aria-label={t('chat.messages')} onClick={() => setDraft('Nội dung mới')}>{t('chat.messages')}</button><p>{draft}</p><span>{t('feed.post')}</span></>
    }
    function render(locale: string) {
      return <UiLocaleContext.Provider value={{ locale }}><Child /></UiLocaleContext.Provider>
    }
    try {
      await act(async () => root.render(render('vi')))
      expect(host.querySelector('button')?.textContent).toBe('Tin nhắn')
      await act(async () => host.querySelector('button')?.click())
      await act(async () => root.render(render('en')))
      expect(host.querySelector('button')?.textContent).toBe('Messages')
      expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('Messages')
      expect(host.querySelector('span')?.textContent).toBe('Post')
      expect(host.querySelector('p')?.textContent).toBe('Nội dung mới')
      await act(async () => root.render(render('vi')))
      expect(host.querySelector('button')?.textContent).toBe('Tin nhắn')
    } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
  })
})