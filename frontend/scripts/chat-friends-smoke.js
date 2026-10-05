// With Vite running: playwright-cli open http://127.0.0.1:5174
// playwright-cli run-code --filename frontend/scripts/chat-friends-smoke.js
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message) }
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const user = { id: 1, username: 'tester', displayName: 'Tester', email: 'test@example.com' }
  const peer = { id: 2, username: 'minhanh', displayName: 'Minh Anh', online: true, updatedAt: new Date().toISOString() }
  let connection = null
  let failRead = true
  let failWrite = false
  let crossedRequest = false
  let writes = 0
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path.endsWith('/avatar') || path.endsWith('/cover')) return route.fulfill({ status: 404, body: '' })
    if (path === '/api/profile') return json({ ...user, avatarSet: false, coverSet: false })
    if (path === '/api/preferences') return json({ autoTranslate: false, targetLanguage: 'vi', appLocale: 'vi' })
    if (path === '/api/i18n/bundle') return json(request.postDataJSON())
    if (path === '/api/friends' || path === '/api/friends/requests') {
      if (failRead) return json({ error: 'unavailable' }, 503)
      return json(connection && (path.endsWith('/requests') ? connection.status === 'pending' : connection.status === 'accepted') ? [connection] : [])
    }
    if (path === '/api/friends/2' || path === '/api/friends/2/accept') {
      writes++
      await new Promise((resolve) => setTimeout(resolve, 150))
      if (failWrite) return route.abort('failed')
      if (request.method() === 'DELETE') {
        check(url.searchParams.get('direction') === connection?.direction, 'Missing expected request direction')
        connection = null
        return json({ ok: true, userId: 2 })
      }
      connection = { ...peer, status: path.endsWith('/accept') ? 'accepted' : 'pending',
        direction: path.endsWith('/accept') ? undefined : crossedRequest ? 'incoming' : 'outgoing' }
      return json(connection)
    }
    if (path === '/api/conversations') return json([
      { id: 10, type: 'direct', name: peer.displayName, otherUserId: 2, online: true, memberCount: 2, unreadCount: 0, lastMessage: 'Chào bạn', createdAt: peer.updatedAt },
      { id: 11, type: 'group', name: 'Nhóm thử nghiệm', memberCount: 2, unreadCount: 0, lastMessage: '', createdAt: peer.updatedAt },
      { id: 12, type: 'direct', name: 'Chính mình', otherUserId: 1, memberCount: 1, unreadCount: 0, lastMessage: '', createdAt: peer.updatedAt },
    ])
    return json([])
  })
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      constructor() {
        super()
        window.chatEvents = this
        setTimeout(() => this.onopen?.(new Event('open')), 0)
      }
      close() {}
    }
  })
  await page.evaluate((value) => localStorage.setItem('chatnet-session', JSON.stringify({ token: 'chat-friends-test', user: value })), user)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(new URL('/', page.url()).href)
  await page.getByRole('button', { name: /Minh Anh.*Chào bạn/ }).click()
  const bar = page.getByLabel('Kết bạn trong cuộc trò chuyện')
  await bar.getByText('Chưa tải được trạng thái kết bạn.').waitFor()
  check(await bar.getByRole('button', { name: 'Gửi lời mời kết bạn', exact: true }).count() === 0, 'Unknown relationship allowed send')
  failRead = false
  await bar.getByRole('button', { name: 'Thử lại' }).click()
  const send = bar.getByRole('button', { name: 'Gửi lời mời kết bạn', exact: true })
  await send.waitFor()
  failWrite = true
  await send.click()
  await page.getByText('Không cập nhật được lời mời kết bạn. Kiểm tra kết nối rồi thử lại.').waitFor()
  await page.waitForFunction(() => !document.querySelector('.chat-friend-actions button')?.disabled)
  failWrite = false
  const before = writes
  await send.evaluate((button) => { button.click(); button.click() })
  await bar.getByText('Đã gửi lời mời kết bạn', { exact: true }).waitFor()
  check(writes === before + 1, 'Double click sent duplicate request')
  await page.waitForFunction(() => !document.querySelector('.chat-friend-actions button')?.disabled)
  await bar.getByRole('button', { name: 'Hủy lời mời' }).click()
  await send.waitFor()
  crossedRequest = true
  await send.click()
  await bar.getByText('Bạn nhận được lời mời kết bạn').waitFor()
  await page.waitForFunction(() => !document.querySelector('.chat-friend-actions button')?.disabled)
  await bar.getByRole('button', { name: 'Chấp nhận', exact: true }).click()
  await bar.getByText('Hai bạn đã là bạn bè').waitFor()
  check(await bar.getByRole('button').count() === 0, 'Friend still has request controls')
  const update = () => page.evaluate(() => window.chatEvents.dispatchEvent(new MessageEvent('update', { data: JSON.stringify({ type: 'friend.updated' }) })))
  connection = { ...peer, status: 'pending', direction: 'incoming' }
  await update()
  await bar.getByRole('button', { name: 'Từ chối', exact: true }).waitFor()
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    check(await bar.evaluate((node) => node.scrollWidth <= node.clientWidth), `Friend bar overflow at ${width}`)
    for (const button of await bar.getByRole('button').all()) {
      check(await button.evaluate((node) => node.scrollWidth <= node.clientWidth), `Button overflow at ${width}`)
    }
    await page.screenshot({ path: `output/playwright/chat-friends-${width}.png` })
  }
  failWrite = true
  await bar.getByRole('button', { name: 'Từ chối', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.chat-friend-actions button')?.disabled)
  check(await bar.getByRole('button', { name: 'Chấp nhận', exact: true }).count() === 1, 'Failed decline lost incoming request')
  failWrite = false
  await bar.getByRole('button', { name: 'Từ chối', exact: true }).click()
  await send.waitFor()
  crossedRequest = false
  await send.click()
  await bar.getByRole('button', { name: 'Hủy lời mời' }).waitFor()
  connection = { ...peer, status: 'accepted' }
  await update()
  await bar.getByText('Hai bạn đã là bạn bè').waitFor()
  connection = null
  await page.evaluate(() => window.chatEvents.onopen(new Event('open')))
  await send.waitFor()
  await page.getByRole('button', { name: /Nhóm thử nghiệm.*2 thành viên/ }).click()
  check(await bar.count() === 0, 'Group has friend controls')
  await page.getByRole('button', { name: /Chính mình.*Bắt đầu trò chuyện/ }).click()
  check(await bar.count() === 0, 'Self chat has friend controls')
  check(errors.length === 0, errors.join('; '))
  return { passed: true, writes, errors }
}
