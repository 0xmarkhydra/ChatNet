// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { UiLocaleContext, createUiTranslator } from '../../shared/i18n/locale'
import { searchLabels } from '../header/headerContext'
import AppShellNotices from './AppShellNotices'

it('updates system notices, accessible labels and search placeholders in all five locales', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  const root = createRoot(host)
  const noOp = () => {}
  const messages = [
    ['vi', 'Đã sao chép tin nhắn.', 'Tìm liên hệ, tin nhắn, file', 'Đóng thông báo'],
    ['en', 'Message copied.', 'Search contacts, messages, files', 'Dismiss notification'],
    ['zh', '消息已复制。', '搜索联系人、消息、文件', '关闭通知'],
    ['ja', 'メッセージをコピーしました。', '連絡先、メッセージ、ファイルを検索', '通知を閉じる'],
    ['ko', '메시지를 복사했습니다.', '연락처, 메시지, 파일 검색', '알림 닫기'],
  ]
  try {
    for (const [locale, message, placeholder, label] of messages) {
      await act(async () => root.render(<UiLocaleContext.Provider value={{ locale }}>
        <AppShellNotices showPushPrompt={false} pushBusy={false} notice={{ id: 1, kind: 'success', message: 'Đã sao chép tin nhắn.' }}
          onDismissPushPrompt={noOp} onEnablePush={noOp} onDismissNotice={noOp} />
      </UiLocaleContext.Provider>))
      expect(host.querySelector('.toast-copy span')?.textContent).toBe(message)
      expect(host.querySelector('button')?.getAttribute('aria-label')).toBe(label)
      expect(searchLabels('chat', createUiTranslator(locale)).placeholder).toBe(placeholder)
    }
    await act(async () => root.render(<UiLocaleContext.Provider value={{ locale: 'ja' }}>
      <AppShellNotices showPushPrompt={false} pushBusy={false} notice={{ id: 2, kind: 'error', message: 'Lỗi máy chủ chưa xác định @Nguyễn' }}
        onDismissPushPrompt={noOp} onEnablePush={noOp} onDismissNotice={noOp} />
    </UiLocaleContext.Provider>))
    expect(host.querySelector('.toast-copy span')?.textContent).toBe('Lỗi máy chủ chưa xác định @Nguyễn')
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})
