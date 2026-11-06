import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'output')
const server = await createServer({
  root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
})
let browser
try {
  await mkdir(output, { recursive: true })
  await server.listen()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const requests = []
  const session = {
    token: 'test.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
    refreshToken: 'r'.repeat(43),
    sessionId: 'auth-flow-test',
    user: { id: 171, email: 'hello@example.com', username: 'hello', displayName: 'Hello' },
  }
  await context.route('http://localhost:8080/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (data, status = 200) => route.fulfill({
      status, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      body: JSON.stringify(data),
    })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (path === '/api/auth/login') {
      requests.push({ path, data: request.postDataJSON() })
      return request.postDataJSON().password === 'a-strong-password'
        ? json(session) : json({ error: 'invalid email or password' }, 401)
    }
    if (path === '/api/auth/email/start') {
      requests.push({ path, data: request.postDataJSON() })
      return json({ verificationToken: 'mock-token-1234567890', emailMasked: 'h***@example.com', expiresInSeconds: 600 }, 202)
    }
    if (path === '/api/auth/email/verify') {
      requests.push({ path, data: request.postDataJSON() })
      return request.postDataJSON().code === '654321'
        ? json(session) : json({ error: 'Mã xác minh không đúng' }, 401)
    }
    if (path === '/api/auth/email/resend') return json({ verificationToken: 'mock-token-1234567890', emailMasked: 'h***@example.com', expiresInSeconds: 600 })
    if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: ': connected\n\n' })
    if (path === '/api/preferences') return json({ appLocale: 'auto', targetLanguage: 'en', autoTranslate: false })
    return json([])
  })
  const page = await context.newPage()
  const jsErrors = []
  page.on('pageerror', error => jsErrors.push(error.message))
  await page.setViewportSize({ width: 1124, height: 704 })
  await page.goto(origin)
  await page.getByRole('heading', { name: /Chào mừng trở lại/ }).waitFor()
  assert.ok(await page.locator('.auth-hero').isVisible())
  assert.ok(await page.getByLabel('Mật khẩu', { exact: true }).isVisible())
  await page.getByLabel('Email', { exact: true }).fill('hello@example.com')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).last().click()
  await page.getByRole('alert').getByText(/mật khẩu không đúng/).waitFor()
  await page.getByLabel('Mật khẩu', { exact: true }).fill('a-strong-password')
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click()
  assert.equal(await page.getByLabel('Mật khẩu', { exact: true }).getAttribute('type'), 'text')
  await page.screenshot({ path: resolve(output, 'auth-login-desktop.png') })
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).last().click()
  await page.locator('.auth-layout').waitFor({ state: 'detached' })
  assert.ok(requests.some(request => request.path === '/api/auth/login' && request.data.password === 'a-strong-password'))
  console.log('PASS đăng nhập mật khẩu: hiển thị/ẩn, lỗi, phiên đăng nhập')

  const contextSignup = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1124, height: 704 } })
  await contextSignup.route('http://localhost:8080/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(data) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (path === '/api/auth/email/start') {
      requests.push({ path, data: request.postDataJSON() })
      return json({ verificationToken: 'mock-token-1234567890', emailMasked: 'h***@example.com', expiresInSeconds: 600 }, 202)
    }
    if (path === '/api/auth/email/verify') {
      requests.push({ path, data: request.postDataJSON() })
      return request.postDataJSON().code === '654321' ? json(session) : json({ error: 'Mã xác minh không đúng' }, 401)
    }
    if (path === '/api/auth/email/resend') {
      requests.push({ path })
      return json({ verificationToken: 'mock-token-1234567890', emailMasked: 'h***@example.com', expiresInSeconds: 600 })
    }
    if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: ': connected\n\n' })
    if (path === '/api/preferences' && request.method() === 'PUT') {
      requests.push({ path, data: request.postDataJSON() })
      return json(request.postDataJSON())
    }
    if (path === '/api/preferences') return json({ appLocale: 'auto', targetLanguage: 'en', autoTranslate: false })
    return json([])
  })
  const signup = await contextSignup.newPage()
  signup.on('pageerror', error => jsErrors.push(error.message))
  await signup.goto(origin)
  await signup.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await signup.getByLabel('Email', { exact: true }).fill('hello@example.com')
  await signup.getByRole('button', { name: 'Gửi mã xác minh' }).click()
  await signup.getByRole('heading', { name: 'Xác thực email' }).waitFor()
  await signup.getByLabel('Nhập mã xác minh 6 chữ số').fill('123456')
  await signup.getByRole('button', { name: 'Xác minh và tiếp tục' }).click()
  await signup.getByRole('alert').getByText('Mã xác minh không đúng').waitFor()
  await Promise.all([
    signup.waitForResponse(response => response.url().endsWith('/api/auth/email/resend')),
    signup.getByRole('button', { name: /Gửi lại/ }).click(),
  ])
  await signup.getByLabel('Nhập mã xác minh 6 chữ số').fill('654321')
  await signup.screenshot({ path: resolve(output, 'auth-otp-desktop.png') })
  await signup.getByRole('button', { name: 'Xác minh và tiếp tục' }).click()
  await signup.getByRole('heading', { name: 'Thiết lập ban đầu' }).waitFor()
  await signup.getByText('Tiếng Việt', { exact: true }).click()
  await signup.getByRole('button', { name: 'Tiếp tục' }).click()
  await signup.getByRole('heading', { name: 'Không bỏ lỡ cuộc trò chuyện' }).waitFor()
  await signup.getByRole('button', { name: 'Tiếp tục' }).click()
  await signup.getByRole('heading', { name: 'Quyền thiết bị' }).waitFor()
  await signup.screenshot({ path: resolve(output, 'auth-setup-desktop.png') })
  await signup.getByRole('button', { name: 'Hoàn tất thiết lập' }).click()
  await signup.locator('.auth-layout').waitFor({ state: 'detached' })
  const setupComplete = await signup.evaluate(() => localStorage.getItem('chatnet-setup-complete:171'))
  assert.equal(setupComplete, '1')
  await signup.waitForFunction(() => localStorage.getItem('chatnet-setup-locale:171') === null)
  assert.ok(requests.some(request => request.path === '/api/preferences' && request.data?.appLocale === 'vi' && request.data.targetLanguage === 'en'), 'Setup language must sync to preferences API')
  assert.equal(await signup.evaluate(() => localStorage.getItem('chatnet-app-locale')), 'vi')
  console.log('PASS OTP: lỗi, gửi lại, xác minh, thiết lập ba bước, đồng bộ ngôn ngữ')

  const mobileContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 568 } })
  const mobile = await mobileContext.newPage()
  await mobile.goto(origin)
  await mobile.getByRole('heading', { name: /Chào mừng trở lại/ }).waitFor()
  assert.ok(await mobile.getByRole('button', { name: 'Đăng nhập', exact: true }).last().isVisible())
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await mobile.screenshot({ path: resolve(output, 'auth-login-mobile.png'), fullPage: true })
  console.log('PASS responsive 320px; no horizontal overflow')
  const failingContext = await browser.newContext({ serviceWorkers: 'block' })
  await failingContext.route('http://localhost:8080/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: {
        'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
      } })
    }
    await route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: 'Dịch vụ gửi mã OTP chưa được cấu hình. Vui lòng liên hệ quản trị viên.' }) })
  })
  const failing = await failingContext.newPage()
  failing.on('pageerror', (error) => jsErrors.push(error.message))
  await failing.goto(origin)
  await failing.getByRole('button', { name: 'Đăng nhập bằng mã OTP qua email' }).click()
  await failing.getByLabel('Email', { exact: true }).fill('hello@example.com')
  await failing.getByRole('button', { name: 'Gửi mã OTP' }).click()
  await failing.getByRole('alert').getByText(/Dịch vụ gửi mã OTP chưa được cấu hình/).waitFor()
  assert.equal(await failing.getByRole('heading', { name: /Chào mừng trở lại/ }).count(), 1)
  console.log('PASS OTP provider failure: explicit error, form preserved')
  assert.deepEqual(jsErrors, [], 'unexpected browser JS errors')
} finally {
  await browser?.close()
  await server.close()
}