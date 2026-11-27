import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const origin = process.env.PROFILE_REVIEW_ORIGIN || 'http://127.0.0.1:8183'
const apiOrigin = 'https://api-chat.codelocal.cloud'
const token = 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed'
const session = { token, refreshToken: 'm'.repeat(43), sessionId: 'profile-settings-test', user: {
  id: 1, username: 'tester', displayName: 'Nguyễn Minh Anh', email: 'test@example.invalid',
} }
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }
const profileHeading = 'Cài đặt trang cá nhân'
mkdirSync('output/playwright/profile-settings', { recursive: true })
let browser
try {
  try { browser = await chromium.launch({ headless: true }) }
  catch (error) {
    if (!String(error).includes("Executable doesn't exist")) throw error
    browser = await chromium.launch({ headless: true, channel: 'chrome' })
  }
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' })
    try {
      await context.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
      const page = await context.newPage()
      page.setDefaultTimeout(10000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      let profile = { ...session.user, avatarSet: false, coverSet: false, bio: '', city: '', workplace: '', school: '', updatedAt: new Date().toISOString() }
      let privacy = { searchableByUsername: true, searchableByName: true, searchableByEmail: false, allowFriendRequests: true, showOnlineStatus: true }
      let profileWrites = 0, privacyWrites = 0, failPrivacy = false, failProfile = false
      let blocked = [{ id: 88, username: 'blocked', displayName: 'Tài khoản kiểm thử' }]
      await context.route('**/*', async route => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue()
        if (url.origin !== apiOrigin && url.origin !== origin) return route.abort()
        const json = (data, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) })
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
        if (url.pathname === '/api/events') return route.fulfill({ headers: cors, contentType: 'text/event-stream', body: ': connected\n\n' })
        if (url.pathname === '/api/profile') {
          if (request.method() === 'PUT') {
            profileWrites++
            if (failProfile) return json({ error: 'username đã được sử dụng' }, 409)
            profile = { ...profile, ...request.postDataJSON() }
            return json({ ...profile, token })
          }
          return json(profile)
        }
        if (url.pathname === '/api/privacy') {
          if (request.method() === 'PUT') {
            privacyWrites++
            await delay(250)
            if (failPrivacy) return json({ error: 'offline' }, 503)
            privacy = request.postDataJSON()
          }
          return json(privacy)
        }
        if (url.pathname === '/api/users/blocked') return json(blocked)
        if (url.pathname === '/api/users/88/block' && request.method() === 'DELETE') { blocked = []; return json({ ok: true }) }
        if (url.pathname === '/api/friends') return json([{ id: 2, username: 'friend0', displayName: 'Bạn 1', online: false, status: 'accepted', updatedAt: new Date().toISOString() }])
        if (url.pathname === '/api/preferences' || url.pathname === '/api/preferences/translation') return json({ appLocale: 'vi', autoTranslate: false, targetLanguage: 'vi' })
        if (url.pathname === '/api/users/friend0/profile') return json({ id: 2, username: 'friend0', displayName: 'Bạn 1', avatarSet: false, coverSet: false, updatedAt: profile.updatedAt, allowFriendRequests: true, friendCount: 1 })
        if (url.pathname === '/api/profile/note' || url.pathname === '/api/users/friend0/note') return json({ note: null })
        if (url.pathname === '/api/push/config') return json({ configured: false })
        if (/\/api\/users\/.*\/(avatar|cover)$/.test(url.pathname)) return json({}, 404)
        return json([])
      })
      await page.goto(origin)
      const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
      await nav.getByRole('button', { name: 'Cá nhân' }).click()
      const hero = page.locator('.profile-mobile-full-hero')
      await hero.waitFor()
      const sharedHeader = page.locator('.chatnet-appbar')
      assert(await sharedHeader.count() === 0, 'Own profile still renders shared header')
      const profileTop = await hero.boundingBox()
      assert(profileTop && profileTop.y <= 2, 'Own profile has unwanted top gap: ' + JSON.stringify(profileTop))
      assert(await hero.getByRole('button', { name: 'Cài đặt trang cá nhân', exact: true }).isVisible(), 'Profile menu button missing')
      assert(await page.getByRole('button', { name: 'Cài đặt', exact: true }).isVisible(), 'Profile settings button missing')
      const menuButton = hero.getByRole('button', { name: profileHeading, exact: true })
      const back = page.getByRole('button', { name: 'Quay lại', exact: true })
      const heading = name => page.getByRole('heading', { name, exact: true })
      const menuRow = name => page.getByRole('button', { name: new RegExp('^' + name) })
      const noOverflow = async screen => {
        const sizes = await page.locator('.profile-view').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, viewport: innerWidth }))
        assert(sizes.scroll <= sizes.client + 1 && sizes.client <= sizes.viewport, screen + ' overflows: ' + JSON.stringify(sizes))
      }
      const menuBounds = await menuButton.boundingBox()
      assert(menuBounds?.width >= 44 && menuBounds?.height >= 44, 'Menu touch target is too small')
      await menuButton.click()
      await heading(profileHeading).waitFor()
      await noOverflow('menu')
      assert(await heading(profileHeading).evaluate(node => parseFloat(getComputedStyle(node).fontSize)) === 17, 'Settings heading must be 17px')
      const menuMetrics = await menuRow('Chỉnh sửa trang cá nhân').evaluate(node => ({ label: parseFloat(getComputedStyle(node.querySelector('strong')).fontSize), icon: parseFloat(getComputedStyle(node.firstElementChild).borderRadius), height: node.getBoundingClientRect().height }))
      assert(menuMetrics.label === 15 && menuMetrics.icon === 10 && menuMetrics.height >= 60, 'Menu design metrics: ' + JSON.stringify(menuMetrics))
      assert(await page.locator('.chatnet-appbar').count() === 0, 'Duplicate shared app header')
      assert(await page.getByText('1 người bạn', { exact: true }).isVisible(), 'Friend count missing')
      await page.screenshot({ path: 'output/playwright/profile-settings/menu-' + width + '.png' })
      await menuRow('Chỉnh sửa trang cá nhân').click()
      await heading('Chỉnh sửa trang cá nhân').waitFor()
      const bio = page.locator('textarea[name="bio"]')
      await bio.waitFor()
      const save = page.getByRole('button', { name: 'Lưu thay đổi', exact: true })
      assert(await save.isDisabled(), 'Unchanged form can save')
      await noOverflow('editor')
      const bioMetrics = await bio.evaluate(node => ({ field: node.getBoundingClientRect().toJSON(), count: node.nextElementSibling.getBoundingClientRect().toJSON(), position: getComputedStyle(node.nextElementSibling).position }))
      assert(bioMetrics.position === 'absolute' && bioMetrics.count.bottom <= bioMetrics.field.bottom && bioMetrics.count.right <= bioMetrics.field.right, 'Bio counter must sit inside the field')
      assert(await bio.evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 16), 'Biography field font is below 16px')
      const saveBounds = await save.boundingBox()
      const navBounds = await nav.boundingBox()
      assert(saveBounds && navBounds && saveBounds.y + saveBounds.height <= navBounds.y + 1, 'Save is under the bottom navigation: ' + JSON.stringify({ saveBounds, navBounds }))
      await page.screenshot({ path: 'output/playwright/profile-settings/editor-' + width + '.png' })
      await bio.fill('Tiểu sử mới')
      assert(await save.isEnabled(), 'Bio-only change does not enable save')
      failProfile = true
      await save.click()
      await page.getByText('username đã được sử dụng', { exact: true }).waitFor()
      assert(await bio.inputValue() === 'Tiểu sử mới', 'Failed save discarded draft')
      failProfile = false
      await save.click()
      await page.getByText('Đã lưu thông tin hồ sơ.', { exact: true }).waitFor()
      assert(profile.bio === 'Tiểu sử mới' && profileWrites === 2, 'Profile save contract changed')
      assert(await save.isDisabled(), 'Saved draft is still dirty')
      await bio.fill('Bản nháp')
      await page.getByRole('button', { name: 'Hủy', exact: true }).click()
      assert(await bio.inputValue() === 'Tiểu sử mới', 'Cancel did not restore stored data')
      await back.click()
      await heading(profileHeading).waitFor()
      await menuRow('Quyền hiển thị').click()
      await heading('Quyền hiển thị').waitFor()
      const switches = page.getByRole('switch')
      assert(await switches.count() === 5, 'Incorrect privacy switch count')
      await noOverflow('privacy')
      const track = await switches.first().locator('span').first().boundingBox()
      assert(track?.width === 48 && track?.height === 28, 'Privacy switch track dimensions changed')
      await page.screenshot({ path: 'output/playwright/profile-settings/privacy-' + width + '.png' })
      const emailSwitch = page.getByRole('switch', { name: 'Cho phép tìm bằng email' })
      await emailSwitch.click()
      await page.waitForFunction(() => Array.from(document.querySelectorAll('button[role="switch"]')).every(button => button.disabled))
      await page.waitForFunction(() => document.querySelector('button[aria-label="Cho phép tìm bằng email"]')?.getAttribute('aria-checked') === 'true')
      assert(privacyWrites === 1 && privacy.searchableByEmail, 'Privacy save not connected')
      failPrivacy = true
      await emailSwitch.click()
      await page.getByText('Lưu thất bại. Cài đặt trước đó vẫn được giữ.', { exact: true }).waitFor()
      assert(await emailSwitch.getAttribute('aria-checked') === 'true', 'Failed privacy save lost old setting')
      await back.click()
      await heading(profileHeading).waitFor()
      await menuRow('Mã QR trang cá nhân').click()
      const qr = page.getByRole('dialog', { name: 'Kết nối bằng QR' })
      await qr.waitFor()
      assert(await qr.getByRole('button', { name: 'QR của tôi', exact: true }).getAttribute('aria-pressed') === 'true', 'QR did not open in mine mode')
      assert(await qr.getByRole('button', { name: 'Quét QR' }).isVisible(), 'Existing scan tab lost')
      await qr.getByRole('button', { name: 'Đóng QR' }).click()
      await menuRow('Người dùng đã chặn').click()
      await heading('Người dùng đã chặn').waitFor()
      await page.getByText('@blocked', { exact: true }).waitFor()
      page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: 'Bỏ chặn', exact: true }).click()
      await page.getByText('Chưa chặn tài khoản nào.', { exact: true }).waitFor()
      await back.click()
      await back.click()
      await hero.waitFor()
      await hero.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click()
      await heading('Chỉnh sửa trang cá nhân').waitFor()
      await bio.fill('Không lưu')
      page.once('dialog', dialog => dialog.dismiss())
      await back.click()
      assert(await bio.isVisible(), 'Dismiss did not keep editor open')
      page.once('dialog', dialog => dialog.accept())
      await back.click()
      await hero.waitFor()
      await menuButton.click()
      await menuRow('Bài viết đã lưu').click()
      await page.waitForFunction(() => location.pathname.startsWith('/feed'))
      await sharedHeader.waitFor()
      await page.goto(origin + '/users/friend0')
      const visitor = page.getByRole('region', { name: 'Trang cá nhân người dùng' })
      await visitor.getByRole('button', { name: 'Nhắn tin', exact: true }).waitFor()
      assert(await sharedHeader.count() === 0, 'Visitor profile still renders shared header')
      const visitorTop = await visitor.locator('.profile-mobile-full-hero').boundingBox()
      assert(visitorTop && visitorTop.y <= 2, 'Visitor profile has unwanted top gap: ' + JSON.stringify(visitorTop))
      await nav.getByRole('button', { name: 'Bảng tin', exact: true }).click()
      await sharedHeader.waitFor()
      assert(!errors.length, 'Browser runtime errors: ' + errors.join('; '))
      console.log('PASS ' + width + 'px: profile and visitor header absent, feed header restored, menu, edit, media placeholders, save/cancel/errors, privacy save/rollback, QR, blocked list/unblock, back and saved feed; no horizontal overflow.')
    } finally { await context.close() }
  }
} finally { await browser?.close() }