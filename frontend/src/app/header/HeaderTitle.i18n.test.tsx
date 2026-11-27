// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { UiLocaleContext } from '../../shared/i18n/locale'
import HeaderTitle from './HeaderTitle'

it('localizes settings and notification headers across the five app locales', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    for (const [locale, title, notice] of [['vi','Cài đặt','Thông báo'],['en','Settings','Notifications'],['zh','设置','通知'],['ja','設定','通知'],['ko','설정','알림']]) {
      act(() => root.render(<UiLocaleContext.Provider value={{ locale }}>
        <HeaderTitle tab="profile" desktopSection={null} translationSettingsOpen={false} groupWorkspaceMode="list" groupCreateStep={1} contactsDirectory={false} profileSettings profileDesktop profileEditing={false} />
        <HeaderTitle tab="notifications" desktopSection={null} translationSettingsOpen={false} groupWorkspaceMode="list" groupCreateStep={1} contactsDirectory={false} profileSettings={false} profileDesktop profileEditing={false} />
      </UiLocaleContext.Provider>))
      expect(Array.from(host.querySelectorAll('.app-page-heading strong'), el => el.textContent)).toEqual([title, notice])
    }
  } finally { act(() => root.unmount()); vi.unstubAllGlobals() }
})
