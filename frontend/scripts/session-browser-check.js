// Run against Vite preview: playwright-cli run-code "$(cat frontend/scripts/session-browser-check.js)"
async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const token = (seconds) => `header.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + seconds })).toString('base64url')}.signature`
  const initial = {
    token: token(-60), refreshToken: 'r'.repeat(43), sessionId: 'browser-test',
    user: { id: 1, email: 'test@example.com', username: 'tester', displayName: 'Test' },
  }
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' })
  let mode = 'ok'
  let refreshes = 0
  const errors = []
  try {
    await context.route('https://api-chat.codelocal.cloud/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', body: '' })
      if (path === '/api/auth/refresh') {
        refreshes++
        if (mode === 'offline') return route.abort('internetdisconnected')
        return route.fulfill({
          status: mode === 'revoked' ? 401 : 200, contentType: 'application/json',
          body: JSON.stringify({ ...initial, token: token(86400) }),
        })
      }
      const body = path === '/api/profile'
        ? { username: 'tester', displayName: 'Test', avatarSet: false, coverSet: false, updatedAt: new Date().toISOString() }
        : path === '/api/preferences' ? { appLocale: 'vi', targetLanguage: 'vi', autoTranslate: false }
        : path === '/api/push/config' ? { configured: false, appId: '' }
        : []
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    })
    const p = await context.newPage()
    p.on('pageerror', (error) => errors.push(error.message))
    await p.goto('http://127.0.0.1:4173/')
    await p.evaluate((session) => localStorage.setItem('chatnet-session', JSON.stringify(session)), initial)
    await p.reload()
    const nav = p.getByRole('navigation', { name: 'Điều hướng chính' })
    await nav.waitFor()
    await p.waitForFunction((old) => JSON.parse(localStorage.getItem('chatnet-session')).token !== old, initial.token)
    assert(refreshes === 1, 'Startup requests should share one refresh')
    await nav.getByRole('button', { name: 'Cá nhân' }).click()
    const name = p.locator('.profile-edit-card input[autocomplete="name"]')
    await name.waitFor()
    await p.waitForFunction(() => document.querySelector('.profile-edit-card input[autocomplete="name"]')?.value === 'Test')
    await name.fill('Bản nháp chưa lưu')

    const other = await context.newPage()
    await other.goto('http://127.0.0.1:4173/')
    // A second tab writes renewed credentials, as it would after background refresh.
    await other.evaluate((session) => {
      localStorage.setItem('chatnet-session', JSON.stringify(session))
    }, { ...initial, token: token(80000) })
    await p.waitForTimeout(300)
    assert(await name.inputValue() === 'Bản nháp chưa lưu', 'Token change erased profile draft')

    mode = 'offline'
    await other.evaluate((session) => localStorage.setItem('chatnet-session', JSON.stringify(session)), initial)
    const before = refreshes
    await p.evaluate(() => window.dispatchEvent(new Event('focus')))
    await p.waitForTimeout(500)
    assert(refreshes > before, 'Focus did not check expired token')
    assert(await nav.isVisible(), 'Offline refresh logged user out')
    assert(await name.inputValue() === 'Bản nháp chưa lưu', 'Offline refresh erased draft')
    assert(await p.evaluate(() => !!localStorage.getItem('chatnet-session')), 'Offline removed saved session')

    mode = 'ok'
    await p.evaluate(() => window.dispatchEvent(new Event('online')))
    await p.waitForFunction((old) => JSON.parse(localStorage.getItem('chatnet-session')).token !== old, initial.token)
    assert(await name.inputValue() === 'Bản nháp chưa lưu', 'Recovery erased draft')
    await p.screenshot({ path: 'output/playwright/session-recovered.png' })
    await p.reload()
    await nav.waitFor()
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem('chatnet-session')).refreshToken === 'r'.repeat(43)), 'Reload lost refresh token')

    mode = 'revoked'
    await other.evaluate((session) => localStorage.setItem('chatnet-session', JSON.stringify(session)), initial)
    await p.evaluate(() => window.dispatchEvent(new Event('focus')))
    await nav.waitFor({ state: 'hidden' })
    await other.getByRole('navigation', { name: 'Điều hướng chính' }).waitFor({ state: 'hidden' })
    assert(await p.evaluate(() => localStorage.getItem('chatnet-session')) === null, 'Revoked session retained')
    assert(errors.length === 0, errors.join('\n'))
    return { passed: true, refreshes, checks: 'expired startup, shared refresh, cross-tab sync, drafts, offline recovery, reopen, revocation' }
  } finally {
    await context.close()
  }
}
