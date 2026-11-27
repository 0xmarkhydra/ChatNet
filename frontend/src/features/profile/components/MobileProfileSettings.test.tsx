// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileProfileEditor, { confirmMobileProfileExit, mobileProfileDirty, type MobileProfileEditorProps } from './MobileProfileEditor'
import { MobileProfileMenu, MobileProfilePrivacy, MobileProfileScreen, isMobileProfileEdit } from './MobileProfileSettings'
import type { ProfileMediaState, UserPrivacy } from '../types'

const profile: ProfileMediaState = {
  username: 'minh.anh', displayName: 'Minh Anh', bio: '', city: '', workplace: '', school: '',
  avatarSet: false, coverSet: false, updatedAt: '2026-11-27',
}
const privacy: UserPrivacy = {
  searchableByUsername: true, searchableByName: true, searchableByEmail: false,
  allowFriendRequests: true, showOnlineStatus: false,
}
const editorProps = (): MobileProfileEditorProps => ({
  profile, username: profile.username, displayName: profile.displayName, hasEmail: false,
  displayNameDraft: profile.displayName, usernameDraft: profile.username, bioDraft: '', cityDraft: '',
  publicDetailsDraft: { workplace: '', school: '' }, saving: false, mediaBusy: false,
  setDisplayNameDraft: vi.fn(), setUsernameDraft: vi.fn(), setBioDraft: vi.fn(),
  setCityDraft: vi.fn(), setPublicDetailsDraft: vi.fn(),
  onSave: vi.fn(), onDiscard: vi.fn(), onChangeAvatar: vi.fn(), onChangeCover: vi.fn(),
})

const mounted: Array<{ host: HTMLElement; root: ReturnType<typeof createRoot> }> = []
async function mount(node: ReactNode) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  mounted.push({ host, root })
  const render = async (next: ReactNode) => act(async () => root.render(next))
  await render(node)
  const button = (label: string) => Array.from(host.querySelectorAll('button')).find(
    item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label,
  )
  return { host, render, button, click: async (label: string) => {
    const item = button(label)
    expect(item).toBeDefined()
    await act(async () => item?.click())
  } }
}
afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('mobile profile settings', () => {
  it('shows exactly five supported menu actions and routes each row through its callback', async () => {
    const actions = { onEdit: vi.fn(), onQr: vi.fn(), onPrivacy: vi.fn(), onBlocked: vi.fn(), onSaved: vi.fn() }
    const { host, render } = await mount(<MobileProfileMenu username={profile.username} displayName={profile.displayName} friendCount={0} {...actions} />)
    expect(host.textContent).toContain('@minh.anh')
    expect(host.textContent).not.toContain('0 người bạn')
    const rows = Array.from(host.querySelectorAll('button'))
    expect(rows).toHaveLength(5)
    for (const row of rows) await act(async () => row.click())
    for (const callback of Object.values(actions)) expect(callback).toHaveBeenCalledTimes(1)
    await render(<MobileProfileMenu username={profile.username} displayName={profile.displayName} friendCount={128} {...actions} />)
    expect(host.textContent).toContain('128 người bạn')
    expect(host.textContent).not.toContain('Khóa trang cá nhân')
  })

  it('keeps privacy loading and error states free of invented switch values', async () => {
    const onRetry = vi.fn()
    const onSave = vi.fn(async () => {})
    const { host, render, click } = await mount(<MobileProfilePrivacy privacy={null} loading busy={false} error="" onRetry={onRetry} onSave={onSave} />)
    expect(host.querySelectorAll('[role="switch"]')).toHaveLength(0)
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Đang tải')
    await render(<MobileProfilePrivacy privacy={null} loading={false} busy={false} error="load error" onRetry={onRetry} onSave={onSave} />)
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải')
    await click('Thử lại')
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('sends only the changed privacy value, waits for authoritative props, and locks all switches while saving', async () => {
    const onSave = vi.fn(async () => {})
    const renderPrivacy = (busy: boolean, error = '') => <MobileProfilePrivacy privacy={privacy} loading={false} busy={busy} error={error} onRetry={vi.fn()} onSave={onSave} />
    const { host, render, click, button } = await mount(renderPrivacy(false))
    expect(host.querySelectorAll('[role="switch"]')).toHaveLength(5)
    await click('Cho phép tìm bằng email')
    expect(onSave).toHaveBeenCalledWith({ ...privacy, searchableByEmail: true })
    expect(button('Cho phép tìm bằng email')?.getAttribute('aria-checked')).toBe('false')
    await render(renderPrivacy(true))
    expect(host.querySelectorAll('button[role="switch"]:disabled')).toHaveLength(5)
    await render(renderPrivacy(false, 'save error'))
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Cài đặt trước đó vẫn được giữ')
    expect(button('Cho phép tìm bằng email')?.getAttribute('aria-checked')).toBe('false')
  })

  it('renders a profile skeleton and a new profile without fabricated media or private email', async () => {
    const props = editorProps()
    const { host, render, button } = await mount(<MobileProfileEditor {...props} profile={null} />)
    expect(host.querySelector('form')).toBeNull()
    expect(host.querySelector('[role="status"]')).not.toBeNull()
    await render(<MobileProfileEditor {...props} />)
    expect(host.querySelectorAll('img')).toHaveLength(0)
    expect(host.textContent).not.toContain('Email chỉ hiển thị')
    expect(host.querySelector('textarea[name="bio"]')?.getAttribute('maxlength')).toBe('160')
    expect(host.querySelector('input[name="city"]')?.getAttribute('maxlength')).toBe('100')
    expect(button('Lưu thay đổi')?.disabled).toBe(true)
    await render(<MobileProfileEditor {...props} hasEmail />)
    expect(host.textContent).toContain('Email chỉ hiển thị với bạn.')
    expect(host.querySelector('input[type="email"]')).toBeNull()
  })

  it('treats bio-only changes as dirty and disables invalid or in-flight submissions', async () => {
    const props = editorProps()
    const changed = { ...props, bioDraft: 'Giới thiệu mới' }
    expect(mobileProfileDirty(props)).toBe(false)
    expect(mobileProfileDirty(changed)).toBe(true)
    const { host, render, button, click } = await mount(<MobileProfileEditor {...changed} />)
    expect(button('Lưu thay đổi')?.disabled).toBe(false)
    await click('Lưu thay đổi')
    expect(props.onSave).toHaveBeenCalledOnce()
    await click('Hủy')
    expect(props.onDiscard).toHaveBeenCalledOnce()
    await render(<MobileProfileEditor {...changed} usernameDraft="x!" />)
    expect(button('Lưu thay đổi')?.disabled).toBe(true)
    await render(<MobileProfileEditor {...changed} displayNameDraft=" " />)
    expect(button('Lưu thay đổi')?.disabled).toBe(true)
    await render(<MobileProfileEditor {...changed} saving />)
    expect(button('Đang lưu…')?.disabled).toBe(true)
    expect(host.querySelectorAll('input:disabled, textarea:disabled')).toHaveLength(6)
    await render(<MobileProfileEditor {...changed} mediaBusy />)
    expect(button('Lưu thay đổi')?.disabled).toBe(true)
    expect(host.querySelectorAll('button:disabled')).toHaveLength(4)
  })

  it('uses the existing avatar and cover callbacks independently of the text form', async () => {
    const props = editorProps()
    const { host } = await mount(<MobileProfileEditor {...props} />)
    const mediaButtons = Array.from(host.querySelectorAll('button')).filter(item => item.textContent?.trim() === 'Thêm')
    expect(mediaButtons).toHaveLength(2)
    for (const item of mediaButtons) await act(async () => item.click())
    expect(props.onChangeAvatar).toHaveBeenCalledWith(mediaButtons[0])
    expect(props.onChangeCover).toHaveBeenCalledOnce()
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('recognizes both editor entry points and confirms only when dirty', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(isMobileProfileEdit('edit')).toBe(true)
    expect(isMobileProfileEdit('edit-from-menu')).toBe(true)
    expect(isMobileProfileEdit('menu')).toBe(false)
    expect(confirmMobileProfileExit(false)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(confirmMobileProfileExit(true)).toBe(false)
    confirm.mockReturnValue(true)
    expect(confirmMobileProfileExit(true)).toBe(true)
    const onBack = vi.fn()
    const { click, render, button } = await mount(<MobileProfileScreen title="Quyền hiển thị" onBack={onBack}>Nội dung</MobileProfileScreen>)
    expect(document.activeElement?.textContent).toBe('Quyền hiển thị')
    await click('Quay lại')
    expect(onBack).toHaveBeenCalledOnce()
    await render(<MobileProfileScreen title="Chỉnh sửa trang cá nhân" onBack={onBack} backDisabled>Nội dung</MobileProfileScreen>)
    expect(button('Quay lại')?.disabled).toBe(true)
  })
})
