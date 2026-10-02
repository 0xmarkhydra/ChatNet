// Run from repository root with Vite running:
// playwright-cli open http://127.0.0.1:5173
// playwright-cli run-code --filename frontend/scripts/ui-smoke.js
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  const origin = 'http://127.0.0.1:5173'
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin)
  await page.evaluate(() => localStorage.setItem('chatnet-session', '{"user":null}'))
  await page.reload()
  await page.getByRole('heading', { name: 'ChatNet', exact: true }).waitFor()
  await page.setViewportSize({ width: 1440, height: 900 })
  check(await page.locator('.auth-card').evaluate((node) =>
    parseFloat(getComputedStyle(node).borderRadius) >= 24,
  ), 'Auth card lost iOS corner radius')
  await page.screenshot({ path: 'output/playwright/auth-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 320, height: 568 })
  const otp = page.getByRole('button', { name: 'Gửi mã OTP', exact: true })
  await otp.scrollIntoViewIfNeeded()
  check(await otp.isVisible(), 'Registration must remain reachable on short screens')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Auth overflows horizontally')
  await page.screenshot({ path: 'output/playwright/auth-mobile.png', fullPage: true })

  const conversations = [
    { id: 1, name: 'minhanh', type: 'direct', otherUserId: 2, memberCount: 2, unreadCount: 2, lastMessage: 'Chiều nay mình xem lại bản thiết kế nhé.', online: true, createdAt: '2026-10-02T07:00:00Z' },
    { id: 2, name: 'hoangnam', type: 'direct', otherUserId: 3, memberCount: 2, unreadCount: 0, lastMessage: 'Cảm ơn bạn, mình nhận được rồi.', online: false, createdAt: '2026-10-02T06:00:00Z' },
    { id: 3, name: 'Nhóm thiết kế', type: 'group', memberCount: 5, unreadCount: 0, lastMessage: 'Hẹn cả nhóm ngày mai.', online: false, createdAt: '2026-10-02T05:00:00Z' },
  ]
  let sends = 0
  let failSend = true
  let releaseSend
  let holdSend = false
  const authRequests = []
  const searchQueries = []
  const session = {
    token: 'ui-smoke-only',
    user: { id: 1, email: 'test@example.com', username: 'user_1234567890abcdef', displayName: 'Old Display Name' },
  }
  await page.route('http://localhost:8080/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/api/auth/email/start') {
      authRequests.push(request.postDataJSON())
      return json({ verificationToken: 'test-verification-token', emailMasked: 't***@example.com', expiresInSeconds: 600 }, 202)
    }
    if (path === '/api/auth/email/verify') {
      if (request.postDataJSON().code !== '123456') return json({ error: 'Mã xác minh không đúng' }, 401)
      return json(session)
    }
    if (path === '/api/auth/email/resend') return json({ verificationToken: 'test-verification-token', emailMasked: 't***@example.com', expiresInSeconds: 600 })
    if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' })
    if (path === '/api/preferences/translation') return json({ autoTranslate: false, targetLanguage: 'en' })
    if (path === '/api/conversations/direct') return json(conversations[0])
    if (path === '/api/conversations') return json(conversations)
    if (path.endsWith('/messages') && request.method() === 'POST') {
      sends++
      if (failSend) return route.abort('failed')
      if (holdSend) await new Promise((resolve) => { releaseSend = resolve })
      return json({ id: 20 }, 201)
    }
    if (path.endsWith('/messages')) return json([
      { id: 10, conversationId: Number(path.split('/')[3]), senderId: 2, sender: 'minhanh', text: 'Chào bạn! Màu xanh mới nhìn rất rõ trên nền sáng.', createdAt: '2026-10-02T07:01:00Z' },
      { id: 11, conversationId: Number(path.split('/')[3]), senderId: 1, sender: session.user.username, text: 'Mình sẽ gửi bản cập nhật trong chiều nay.', createdAt: '2026-10-02T07:02:00Z' },
    ])
    if (path === '/api/users/suggestions' || path === '/api/users/search') {
      if (path === '/api/users/search') searchQueries.push(new URL(request.url()).searchParams.get('q'))
      return json([{ id: 2, username: 'minhanh', displayName: 'Minh Anh', online: true }])
    }
    if (path === '/api/posts') return json([
      { id: 1, author: 'minhanh', content: 'Một ngày làm việc cùng đội thiết kế. Cảm ơn mọi người đã góp ý cho bản cập nhật ChatNet!', likes: 8, liked: false, comments: [], createdAt: '2026-10-02T07:00:00Z' },
    ])
    return json({})
  })
  check(await page.locator('.auth-card input').count() === 1, 'Signup must require email only')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await otp.click()
  const codeInput = page.getByLabel('Mã xác minh', { exact: true })
  await codeInput.fill('000000')
  await page.getByRole('button', { name: 'Xác minh & vào ChatNet', exact: true }).click()
  await page.getByText('Mã xác minh không đúng', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Gửi lại mã', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.otp-input').value === '')
  await codeInput.fill('123456')
  await page.getByRole('button', { name: 'Xác minh & vào ChatNet', exact: true }).click()
  check(authRequests.length === 1 && JSON.stringify(authRequests[0]) === '{"email":"test@example.com"}', 'Signup sent extra identity fields')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: /minhanh.*Chiều nay/ }).click()
  const input = page.getByRole('textbox', { name: 'Tin nhắn', exact: true })
  await input.fill('Bản nháp không được mất')
  await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click()
  await page.getByText('Chưa xác nhận được tin đã gửi.', { exact: false }).waitFor()
  check(await input.inputValue() === 'Bản nháp không được mất', 'Network failure lost draft')
  await page.setViewportSize({ width: 320, height: 568 })
  const notice = await page.getByRole('status').boundingBox()
  const back = await page.getByRole('button', { name: 'Quay lại danh sách' }).boundingBox()
  const composer = await input.boundingBox()
  check(notice && back && notice.y + notice.height <= back.y, 'Notice covers mobile navigation')
  check(composer && composer.y + composer.height <= 568, 'Notice pushes composer outside viewport')
  await page.getByRole('button', { name: 'Đóng thông báo' }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: /hoangnam.*Cảm ơn/ }).click()
  check(await input.inputValue() === '', 'Draft leaked to another conversation')
  await input.fill('Bản nháp của Nam')
  await page.getByRole('button', { name: /minhanh.*Chiều nay/ }).click()
  check(await input.inputValue() === 'Bản nháp không được mất', 'Switching conversation lost draft')
  failSend = false
  holdSend = true
  await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Tin nhắn"]').disabled)
  check(await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).isDisabled(), 'Pending send allows duplicates')
  await page.getByRole('button', { name: /hoangnam.*Cảm ơn/ }).click()
  for (let tries = 0; !releaseSend && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 20))
  check(releaseSend, 'Send request did not reach mocked API')
  releaseSend()
  await page.waitForFunction(() => !document.querySelector('[aria-label="Tin nhắn"]').disabled)
  check(await input.inputValue() === 'Bản nháp của Nam', 'Successful send cleared another draft')
  check(sends === 2, 'Unexpected duplicate send')
  await page.getByRole('button', { name: /minhanh.*Chiều nay/ }).click()
  check(await input.inputValue() === '', 'Successful send did not clear submitted draft')
  await page.screenshot({ path: 'output/playwright/chat-desktop.png' })

  await page.getByRole('button', { name: 'Danh bạ', exact: true }).click()
  const friendSearch = page.getByRole('textbox', { name: 'Tìm bạn bằng email hoặc username', exact: true })
  await friendSearch.fill('friend@example.com')
  for (let tries = 0; !searchQueries.includes('friend@example.com') && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 20))
  check(searchQueries.includes('friend@example.com'), 'Email search did not reach API')
  await page.getByRole('button', { name: /@minhanh.*Nhắn tin/ }).click()
  await input.waitFor()
  check(await input.isVisible(), 'Contact did not navigate to chat')
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1440, height: 700 }]) {
    await page.setViewportSize(viewport)
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Chat overflows horizontally')
    const box = await input.boundingBox()
    check(box && box.y >= 0 && box.y + box.height <= viewport.height, 'Composer outside viewport')
    if (viewport.width <= 390) {
      const room = await page.locator('.room-info').boundingBox()
      const controls = await page.locator('.translate-controls').boundingBox()
      check(room && controls && room.y + room.height <= controls.y, 'Translation controls squeeze chat title')
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'output/playwright/chat-mobile.png' })
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click()
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Conversation list overflows horizontally')
    const search = await page.locator('.appbar-search').boundingBox()
    const actions = await page.locator('.appbar-actions').boundingBox()
    check(search && actions && search.x + search.width <= actions.x, 'Search overlaps appbar actions')
    for (const button of await page.locator('.appbar-icon-button').all()) {
      const box = await button.boundingBox()
      check(box && box.width >= 44 && box.height >= 44, 'Appbar tap target smaller than 44px')
    }
  }
  for (const selector of ['.chatnet-appbar', '.bottom-navigation']) {
    check(await page.locator(selector).evaluate((node) => {
      const style = getComputedStyle(node)
      return style.backdropFilter.includes('blur') || style.webkitBackdropFilter.includes('blur')
    }), `${selector} lost glass blur`)
  }
  await page.screenshot({ path: 'output/playwright/list-mobile.png' })
  await page.getByRole('button', { name: 'Danh bạ', exact: true }).click()
  await page.screenshot({ path: 'output/playwright/contacts-mobile.png' })
  await page.getByRole('button', { name: 'Tường nhà', exact: true }).click()
  await page.getByText('Một ngày làm việc cùng đội thiết kế.', { exact: false }).waitFor()
  await page.screenshot({ path: 'output/playwright/feed-mobile.png', fullPage: true })
  await page.getByRole('button', { name: /Cá nhân/ }).click()
  await page.getByRole('switch', { name: 'Tự động dịch', exact: true }).waitFor()
  check(await page.locator('.profile-identity strong').textContent() === '@user_1234567890abcdef', 'Profile must identify user by username')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Profile overflows horizontally')
  check(await page.locator('.profile-avatar .avatar-initials').evaluate((node) =>
    getComputedStyle(node).fontSize === '24px' && getComputedStyle(node).color === 'rgb(255, 255, 255)',
  ), 'Profile initials lost size or contrast')
  await page.screenshot({ path: 'output/playwright/profile-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await page.getByRole('heading', { name: 'ChatNet', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click()
  check(await page.locator('.auth-card input').count() === 1, 'Returning login must support email-only accounts')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.locator('.auth-submit').click()
  await codeInput.fill('123456')
  await page.getByRole('button', { name: 'Xác minh & vào ChatNet', exact: true }).click()
  await page.getByRole('button', { name: 'Danh bạ', exact: true }).waitFor()
  check(errors.length === 0, `Uncaught errors: ${errors.join('; ')}`)
  console.log('PASS: email-only signup/login, OTP error/resend, username identity, email search, malformed session, responsive auth/chat, isolated drafts, pending send, contacts, profile, logout')
}
