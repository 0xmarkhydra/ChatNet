// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthFlow } from '../hooks/useAuthFlow'
import AuthScreen from './AuthScreen'

vi.mock('../../../platform/desktop', () => ({ isDesktopBuild: false }))
vi.mock('../../i18n', () => ({
  loadAppLocalePreference: () => 'auto', saveAppLocalePreference: vi.fn(),
}))

const validOtp = { verificationToken: 'initial-otp', emailMasked: 'q***@example.test', expiresInSeconds: 30 }
const json = (value: object, status = 200) => new Response(JSON.stringify(value), { status })

async function mount() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const save = vi.fn()
  function Login() { return <AuthScreen {...useAuthFlow(save)} /> }
  await act(async () => root.render(<Login />))
  const button = (label: string) => {
    const match = Array.from(host.querySelectorAll('button')).find((node) => node.textContent?.trim().includes(label))
    if (!match) throw new Error('Missing user action ' + label)
    return match
  }
  const fill = async (id: string, text: string) => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  const click = async (label: string) => act(async () => button(label).click())
  return {
    host, save, button, click, fill,
    async beginOtp() {
      await click('Đăng nhập bằng mã OTP qua email')
      await fill('auth-email', 'qa@example.test')
      await click('Gửi mã OTP')
      expect(host.querySelector('h2')?.textContent).toBe('Xác thực email')
    },
    async close() { await act(async () => root.unmount()); host.remove() },
  }
}

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('auth screen edge cases', () => {
  it('accepts neither an incomplete OTP nor a complete OTP after its expiry', async () => {
    vi.useFakeTimers()
    const load = vi.fn().mockResolvedValueOnce(json({ ...validOtp, expiresInSeconds: 1 }, 202))
    vi.stubGlobal('fetch', load)
    const ui = await mount()
    try {
      await ui.beginOtp()
      await ui.fill('auth-otp-code', '12345')
      expect(ui.button('Xác minh và tiếp tục').disabled).toBe(true)
      await ui.fill('auth-otp-code', '123456')
      expect(ui.button('Xác minh và tiếp tục').disabled).toBe(false)
      await act(async () => vi.advanceTimersByTime(1_000))
      expect(ui.host.textContent).toContain('Mã đã hết hạn')
      expect(ui.button('Xác minh và tiếp tục').disabled).toBe(true)
      await ui.click('Xác minh và tiếp tục')
      expect(load).toHaveBeenCalledOnce()
      expect(ui.save).not.toHaveBeenCalled()
    } finally { await ui.close() }
  })

  it('keeps an OTP form recoverable after a provider rate limit', async () => {
    const load = vi.fn().mockResolvedValueOnce(json(validOtp, 202))
      .mockResolvedValueOnce(json({ error: 'Đợi trước khi gửi lại mã.' }, 429))
    vi.stubGlobal('fetch', load)
    const ui = await mount()
    try {
      await ui.beginOtp()
      await ui.fill('auth-otp-code', '123456')
      await ui.click('Gửi lại')
      expect(ui.host.querySelector('[role="alert"]')?.textContent).toContain('Đợi trước khi gửi lại mã.')
      expect(ui.host.querySelector<HTMLInputElement>('#auth-otp-code')?.value).toBe('123456')
      expect(ui.button('Gửi lại').disabled).toBe(false)
      expect(ui.save).not.toHaveBeenCalled()
    } finally { await ui.close() }
  })

  it('uses only the newest verification token after an accepted resend', async () => {
    const load = vi.fn().mockResolvedValueOnce(json(validOtp, 202))
      .mockResolvedValueOnce(json({ ...validOtp, verificationToken: 'new-otp' }))
      .mockResolvedValueOnce(json({ error: 'Mã không đúng.' }, 401))
    vi.stubGlobal('fetch', load)
    const ui = await mount()
    try {
      await ui.beginOtp()
      await ui.fill('auth-otp-code', '111111')
      await ui.click('Gửi lại')
      expect(ui.host.querySelector<HTMLInputElement>('#auth-otp-code')?.value).toBe('')
      await ui.fill('auth-otp-code', '222222')
      await ui.click('Xác minh và tiếp tục')
      expect(JSON.parse(load.mock.calls[2][1].body)).toEqual({ token: 'new-otp', code: '222222' })
      expect(ui.host.querySelector('[role="alert"]')?.textContent).toBe('Mã không đúng.')
    } finally { await ui.close() }
  })

  it('does not replace the active OTP with an invalid successful resend payload', async () => {
    const load = vi.fn().mockResolvedValueOnce(json(validOtp, 202))
      .mockResolvedValueOnce(json({ emailMasked: validOtp.emailMasked, expiresInSeconds: 30 }))
    vi.stubGlobal('fetch', load)
    const ui = await mount()
    try {
      await ui.beginOtp()
      await ui.fill('auth-otp-code', '123456')
      await ui.click('Gửi lại')
      expect(ui.host.querySelector('[role="alert"]')).not.toBeNull()
      expect(ui.host.querySelector<HTMLInputElement>('#auth-otp-code')?.value).toBe('123456')
    } finally { await ui.close() }
  })

  it('keeps the unsupported Google action out of the email/password form submission path', async () => {
    const load = vi.fn().mockResolvedValue(json({ error: 'invalid email or password' }, 401))
    vi.stubGlobal('fetch', load)
    const ui = await mount()
    try {
      await ui.fill('auth-email', 'qa@example.test')
      await ui.fill('auth-password', 'fake-test-password')
      const google = ui.button('Đăng nhập bằng Google')
      expect(google.type).toBe('button')
      expect(google.disabled).toBe(true)
      expect(google.title).toContain('chưa được hỗ trợ')
      expect(load).not.toHaveBeenCalled()
      expect(ui.save).not.toHaveBeenCalled()
    } finally { await ui.close() }
  })

  it('hides footer legal/support links until each has a real destination', async () => {
    const ui = await mount()
    try {
      const footer = ui.host.querySelector('footer')
      expect(footer?.querySelectorAll('a').length ?? 0).toBe(0)
      expect(footer?.textContent).not.toMatch(/Quyền riêng tư|Điều khoản|Hỗ trợ/)
    } finally { await ui.close() }
  })
})