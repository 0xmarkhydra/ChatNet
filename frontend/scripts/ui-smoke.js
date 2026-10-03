// Run from repository root with Vite running:
// playwright-cli open http://127.0.0.1:5173
// playwright-cli run-code --filename frontend/scripts/ui-smoke.js
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  const origin = 'http://127.0.0.1:5173'
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text())
  })
  await page.unrouteAll({ behavior: 'ignoreErrors' })
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
    { id: 3, name: 'Nhóm thiết kế giao diện ChatNet và kiểm thử trên điện thoại', type: 'group', memberCount: 5, unreadCount: 0, lastMessage: 'Hẹn cả nhóm ngày mai.', online: false, createdAt: '2026-10-02T05:00:00Z' },
  ]
  conversations.forEach((conversation) => { conversation.lastMessageAt = conversation.createdAt })
  let sends = 0
  let failSend = true
  let releaseSend
  let holdSend = false
  const authRequests = []
  const searchQueries = []
  const nearbyRequests = []
  let nearbyFailure = false
  let nearbyEmpty = false
  const translations = []
  const commentRequests = []
  const storyRequests = []
  const presignRequests = []
  let failComment = false
  let releaseComment
  const storyImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640"><rect width="360" height="640" fill="#4c7800"/><text x="180" y="320" fill="white" text-anchor="middle" font-size="38">Story</text></svg>')}`
  let stories = [
    {
      id: 11,
      author: 'minhanh',
      attachment: { storageRef: 's3://mock/story/11.jpg', name: 'story.jpg', sizeBytes: 100, contentType: 'image/jpeg', kind: 'image', url: storyImage },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    {
      id: 10,
      author: 'expired',
      attachment: { storageRef: 's3://mock/story/10.jpg', name: 'expired.jpg', sizeBytes: 100, contentType: 'image/jpeg', kind: 'image', url: storyImage },
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
    },
  ]
  const feedPost = {
    id: 1, author: 'minhanh', content: 'Một ngày làm việc cùng đội thiết kế.',
    likes: 8, liked: true, createdAt: '2026-10-02T07:00:00Z',
    comments: [
      { id: 1, author: 'minhanh', content: 'Bản thiết kế mới rất đẹp.', createdAt: '2026-10-02T07:01:00Z' },
      { id: 2, parentId: 1, author: 'hoangnam', content: 'Mình cũng thích màu xanh này.', createdAt: '2026-10-02T07:02:00Z' },
      { id: 3, parentId: 2, author: 'longusername_1234567890', content: 'https://example.com/averylongunbrokenpaththatmustnotoverflowthenarrowmobilecommentbubble', createdAt: '2026-10-02T07:03:00Z' },
      { id: 4, author: 'lan', content: 'Không dịch được nội dung này.', createdAt: '2026-10-02T07:04:00Z' },
    ],
  }
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
    if (path === '/api/users/nearby') {
      nearbyRequests.push({ method: request.method(), body: request.postData() })
      if (nearbyFailure) return json({ error: 'nearby unavailable' }, 503)
      if (request.method() === 'DELETE') return json({ ok: true })
      return json({
        users: nearbyEmpty ? [] : [
          { id: 2, username: 'minhanh', displayName: 'Minh Anh', online: true, nearbyActive: true, distanceKm: 1.3, locationUpdatedAt: new Date().toISOString() },
          { id: 3, username: 'hoangnam', displayName: 'Hoàng Nam', online: false, nearbyActive: false, distanceKm: 0.4, locationUpdatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
        ],
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        cacheExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        radiusKm: request.postDataJSON()?.radiusKm || 5,
      })
    }
    if (path === '/api/friends' && request.method() === 'GET') {
      return json([{ id: 2, username: 'minhanh', displayName: 'Minh Anh', online: true, status: 'accepted', updatedAt: new Date().toISOString() }])
    }
    if (path === '/api/friends/requests' && request.method() === 'GET') return json([])
    if (path === '/api/preferences/translation') return json({ autoTranslate: false, targetLanguage: 'en' })
    if (path === '/api/translate') {
      const body = request.postDataJSON()
      translations.push(body)
      if (body.text === 'Không dịch được nội dung này.') return json({ error: 'unavailable' }, 503)
      const translatedText = {
        'Một ngày làm việc cùng đội thiết kế.': 'A day working with the design team.',
        'Bản thiết kế mới rất đẹp.': 'The new design looks great.',
        'Mình cũng thích màu xanh này.': 'I like this green too.',
      }[body.text] || body.text
      return json({ translatedText })
    }
    if (path === '/api/media/presign') {
      const body = request.postDataJSON()
      presignRequests.push(body)
      return json({
        uploadUrl: 'http://localhost:8080/story-upload',
        storageRef: 's3://mock/story/upload.jpg',
        key: 'story/upload.jpg',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        kind: 'image',
        downloadUrl: storyImage,
      })
    }
    if (path === '/story-upload' && request.method() === 'PUT') return route.fulfill({ status: 200, body: '' })
    if (path === '/api/stories' && request.method() === 'POST') {
      const body = request.postDataJSON()
      storyRequests.push(body)
      const created = {
        id: 12,
        author: session.user.username,
        attachment: { ...body.attachment, url: storyImage },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
      stories = [created, ...stories]
      return json(created, 201)
    }
    if (path === '/api/stories' && request.method() === 'GET') return json(stories)
    if (path.startsWith('/api/stories/') && request.method() === 'DELETE') {
      const id = Number(path.split('/').pop())
      stories = stories.filter((story) => story.id !== id)
      return route.fulfill({ status: 204, body: '' })
    }
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
    if (path === '/api/posts/1/comments') {
      const body = request.postDataJSON()
      commentRequests.push(body)
      if (failComment) return json({ error: 'unavailable' }, 503)
      await new Promise((resolve) => { releaseComment = resolve })
      feedPost.comments.push({ id: feedPost.comments.length + 1, ...body, author: session.user.username, createdAt: '2026-10-02T08:00:00Z' })
      return json(feedPost, 201)
    }
    if (path === '/api/posts') return json([feedPost])
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
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Conversation list overflows horizontally')
    const search = await page.locator('.appbar-search').boundingBox()
    const actions = await page.locator('.appbar-actions').boundingBox()
    check(search && actions && search.x + search.width <= actions.x, 'Search overlaps appbar actions')
    for (const button of await page.locator('.appbar-icon-button').all()) {
      const box = await button.boundingBox()
      check(box && box.width >= 44 && box.height >= 44, 'Appbar tap target smaller than 44px')
    }
    check(await page.locator('.conversation-item').count() === 3, 'Group hidden from chat list')
    check(await page.getByRole('button', { name: 'Khác', exact: true }).count() === 0, 'Other chat tab remains')
    check(await page.getByRole('button', { name: 'Ưu tiên', exact: true }).count() === 0, 'Priority chat tab remains')
    for (const row of await page.locator('.conversation-item').all()) {
      const avatar = await row.locator('.conversation-avatar').boundingBox()
      const name = await row.locator('strong').boundingBox()
      const preview = await row.locator('.conversation-copy span').boundingBox()
      const time = await row.locator('time').boundingBox()
      const copy = await row.locator('.conversation-copy').boundingBox()
      check(avatar && name && preview && time && copy, 'Missing chat geometry')
      check(name.x - avatar.x - avatar.width >= 6 && name.x - avatar.x - avatar.width <= 16, 'Name not aligned beside avatar')
      check(Math.abs(name.x - preview.x) < 1, 'Preview not aligned with name')
      check(name.x + name.width <= time.x, 'Name overlaps timestamp')
      check(Math.abs(time.x + time.width - (copy.x + copy.width - 10)) < 2, 'Timestamp not right-aligned')
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  for (const selector of ['.chatnet-appbar', '.bottom-navigation']) {
    check(await page.locator(selector).evaluate((node) => {
      const style = getComputedStyle(node)
      return style.backdropFilter.includes('blur') || style.webkitBackdropFilter.includes('blur')
    }), `${selector} lost glass blur`)
  }
  await page.screenshot({ path: 'output/playwright/list-mobile.png' })
  await page.getByRole('button', { name: 'Danh bạ', exact: true }).click()
  await page.screenshot({ path: 'output/playwright/contacts-mobile.png' })
  await page.getByRole('button', { name: 'Quanh đây', exact: true }).click()
  check(await page.locator('.bottom-navigation button.active svg circle').count() === 3, 'Nearby icon is not radar')
  check(await page.locator('.nearby-radar-ring').count() === 2, 'Nearby radar rings are missing')
  check(await page.locator('.nearby-radar-blip').count() === 3, 'Nearby radar targets are missing')
  check(await page.locator('.nearby-radar-sweep').count() === 1, 'Nearby radar sweep is missing')
  check(nearbyRequests.length === 0, 'Location published without consent')
  await page.evaluate(() => {
    window.__realGeolocation = navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (_ok, fail) => fail({ code: 1, message: 'denied' }),
    } })
  })
  await page.getByRole('button', { name: 'Quét quanh đây', exact: true }).click()
  await page.getByText(/PERMISSION_DENIED · mã GPS 1/).waitFor()
  check(nearbyRequests.length === 0, 'Denied location reached API')
  await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition: (ok) => { window.__resolveNearbyLocation = () => ok({ coords: { latitude: 10.77, longitude: 106.69 } }) },
  } }))
  nearbyFailure = true
  await page.getByRole('button', { name: 'Quét quanh đây', exact: true }).click()
  await page.getByText('Radar đang quét...', { exact: true }).waitFor()
  await page.getByRole('dialog', { name: 'Đang quét quanh đây', exact: true }).waitFor()
  check(await page.locator('.nearby-radar.is-scanning').count() === 1, 'Radar is not scanning while nearby request is busy')
  await page.screenshot({ path: 'output/playwright/nearby-scanning-mobile.png', fullPage: true })
  await page.evaluate(() => window.__resolveNearbyLocation())
  await page.getByText('Không tìm được bạn quanh đây. Thử lại sau.', { exact: true }).waitFor()
  nearbyFailure = false
  await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition: (ok) => ok({ coords: { latitude: 10.77, longitude: 106.69 } }),
  } }))
  const scanStartedAt = Date.now()
  await page.getByRole('button', { name: 'Quét quanh đây', exact: true }).click()
  await page.getByRole('dialog', { name: 'Đang quét quanh đây', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Nhắn tin @minhanh', exact: true }).waitFor()
  check(Date.now() - scanStartedAt >= 2600, 'Successful nearby scan closes too quickly')
  await page.getByText(/Khoảng 1,3 km/).waitFor()
  check(
    nearbyRequests.some((request) => request.body === '{"latitude":10.77,"longitude":106.69,"radiusKm":5}'),
    'Wrong geolocation/radius payload',
  )
  const firstNearbyName = await page.locator('.nearby-result .friend-result-copy strong').first().textContent()
  check(firstNearbyName === '@hoangnam', 'Nearby results are not sorted nearest first')
  await page.screenshot({ path: 'output/playwright/nearby-mobile.png', fullPage: true })
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    check(await page.locator('.discover-view').evaluate((node) => node.scrollWidth <= node.clientWidth), `Nearby overflows at ${width}px`)
    await page.screenshot({ path: `output/playwright/nearby-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  nearbyFailure = true
  await page.getByRole('button', { name: 'Tắt Quanh đây', exact: true }).click()
  check(await page.locator('.nearby-radar.is-scanning').count() === 0, 'Radar scans while disabling nearby')
  await page.getByText('Chưa tắt được Quanh đây. Thử lại sau.', { exact: true }).waitFor()
  check(await page.getByRole('button', { name: 'Nhắn tin @minhanh', exact: true }).isVisible(), 'Failed disable falsely cleared state')
  nearbyFailure = false
  await page.getByRole('button', { name: 'Tắt Quanh đây', exact: true }).click()
  await page.getByRole('button', { name: 'Quét quanh đây', exact: true }).waitFor()
  check(await page.locator('.discover-view .friend-result').count() === 0, 'Disabled nearby retained results')
  nearbyEmpty = true
  await page.getByRole('button', { name: 'Quét quanh đây', exact: true }).click()
  await page.getByText('Chưa tìm thấy người phù hợp quanh đây.', { exact: true }).waitFor()
  nearbyEmpty = false
  await page.getByRole('button', { name: 'Quét quanh đây', exact: true }).click()
  await page.getByRole('button', { name: 'Nhắn tin @minhanh', exact: true }).click()
  await input.waitFor()
  check(await input.isVisible(), 'Nearby user did not open chat')
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click()
  await page.getByRole('button', { name: 'Tường nhà', exact: true }).click()
  await page.getByText('A day working with the design team.', { exact: true }).waitFor()
  check(await page.getByRole('button', { name: 'Xem Story của @expired', exact: true }).count() === 0, 'Expired story remains visible')
  await page.getByRole('button', { name: 'Xem Story của @minhanh', exact: true }).click()
  await page.getByRole('dialog', { name: 'Story của @minhanh', exact: true }).waitFor()
  check(await page.locator('.story-viewer-media img').isVisible(), 'Story image viewer missing')
  const storyAvatar = await page.locator('.story-viewer-avatar').boundingBox()
  check(storyAvatar && storyAvatar.width === 38 && storyAvatar.height === 38, 'Story header avatar is stretched')
  await page.screenshot({ path: 'output/playwright/story-mobile.png' })
  await page.getByRole('button', { name: 'Đóng Story', exact: true }).click()
  await page.getByLabel('Chọn ảnh hoặc video cho Story', { exact: true }).setInputFiles({
    name: 'new-story.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('story-image'),
  })
  await page.getByRole('button', { name: `Xem Story của @${session.user.username}`, exact: true }).waitFor()
  check(presignRequests.some((item) => item.scope === 'story' && item.name === 'new-story.jpg'), 'Story upload used wrong scope')
  check(storyRequests.length === 1 && storyRequests[0].attachment.storageRef === 's3://mock/story/upload.jpg', 'Story create payload is wrong')
  await page.getByRole('button', { name: `Xem Story của @${session.user.username}`, exact: true }).click()
  await page.evaluate(() => { window.confirm = () => true })
  await page.getByRole('button', { name: 'Xóa Story', exact: true }).click()
  await page.getByRole('button', { name: `Xem Story của @${session.user.username}`, exact: true }).waitFor({ state: 'detached' })
  check(await page.getByRole('button', { name: 'Khác', exact: true }).count() === 0, 'Other feed tab remains')
  check(translations.some((item) => item.target === 'en' && item.text === feedPost.content), 'Feed did not translate automatically with chat translation disabled')
  check(await page.getByRole('button', { name: 'Dịch AI', exact: true }).count() === 0, 'Manual post translation remains')
  const postText = page.locator('.post-body > .feed-text')
  await postText.getByRole('button', { name: 'Xem bản gốc', exact: true }).click()
  check(await postText.locator('p').textContent() === feedPost.content, 'Original text toggle failed')
  await postText.getByRole('button', { name: 'Xem bản dịch', exact: true }).click()
  await page.getByText('The new design looks great.', { exact: true }).scrollIntoViewIfNeeded()
  await page.getByText('I like this green too.', { exact: true }).waitFor()
  check(await page.locator('.feed-comment-threads > li').count() === 2, 'Replies not grouped by root')
  check(await page.locator('.feed-comment-replies > li').count() === 2, 'Nested reply missing')
  check(await page.getByText('Trả lời @hoangnam', { exact: true }).count() === 1, 'Nested reply lost exact parent')
  await page.getByRole('button', { name: 'Ẩn 2 phản hồi', exact: true }).click()
  check(await page.locator('.feed-comment-replies').count() === 0, 'Collapse failed')
  await page.getByRole('button', { name: 'Xem 2 phản hồi', exact: true }).click()
  await page.getByRole('button', { name: 'Trả lời @hoangnam', exact: true }).click()
  const commentInput = page.getByRole('textbox', { name: 'Phản hồi @hoangnam', exact: true })
  await commentInput.fill('Bản nháp trả lời')
  await page.getByRole('button', { name: /Cá nhân/ }).click()
  await page.getByRole('button', { name: 'Tường nhà', exact: true }).click()
  check(await commentInput.inputValue() === 'Bản nháp trả lời', 'Switching tab lost comment draft or reply target')
  failComment = true
  await page.getByRole('button', { name: 'Gửi bình luận', exact: true }).click()
  await page.getByRole('alert').waitFor()
  check(await commentInput.inputValue() === 'Bản nháp trả lời', 'Failed comment lost draft')
  failComment = false
  await page.getByRole('button', { name: 'Gửi bình luận', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.feed-comment-compose textarea').disabled)
  check(await page.getByRole('button', { name: 'Đang gửi bình luận' }).isDisabled(), 'Comment send allows duplicate')
  await page.getByRole('button', { name: /Cá nhân/ }).click()
  await page.getByRole('button', { name: 'Tường nhà', exact: true }).click()
  check(await commentInput.isDisabled(), 'Switching tab allows duplicate pending comment')
  for (let tries = 0; !releaseComment && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 20))
  check(releaseComment, 'Comment did not reach API')
  releaseComment()
  await page.getByRole('textbox', { name: 'Viết bình luận', exact: true }).waitFor()
  check(commentRequests.length === 2 && commentRequests[1].parentId === 2, 'Reply sent incorrect parent or duplicate')
  check(await page.locator('.feed-comment-replies > li').count() === 3, 'New reply not rendered in thread')
  const rootInput = page.getByRole('textbox', { name: 'Viết bình luận', exact: true })
  check(await rootInput.inputValue() === '', 'Successful reply did not clear draft')
  releaseComment = undefined
  await rootInput.fill('Bình luận mới')
  await rootInput.press('Enter')
  for (let tries = 0; !releaseComment && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 20))
  check(releaseComment, 'Root comment did not reach API')
  check(!('parentId' in commentRequests[2]), 'Root comment inherited parent')
  releaseComment()
  await page.waitForFunction(() => document.querySelectorAll('.feed-comment-threads > li').length === 3)
  await page.getByText('Không dịch được nội dung này.', { exact: true }).scrollIntoViewIfNeeded()
  await page.getByText('Chưa dịch được. Đang hiển thị bản gốc.', { exact: true }).waitFor({ timeout: 10000 })
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('.feed-view').evaluate((node) => { node.scrollTop = 0 })
    check(await page.locator('.feed').evaluate((node) => node.scrollWidth <= node.clientWidth), `Feed overflows at ${width}px`)
    const stories = await page.locator('.stories-row').boundingBox()
    const storyVisual = await page.locator('.story-visual').first().boundingBox()
    check(stories && storyVisual && stories.height >= storyVisual.height, `Story row is clipped at ${width}px`)
    for (const bubble of await page.locator('.feed-comment-bubble').all()) {
      check(await bubble.evaluate((node) => node.scrollWidth <= node.clientWidth), 'Comment bubble overflows')
    }
    await page.screenshot({ path: `output/playwright/feed-${width}.png`, fullPage: true })
  }
  check(translations.filter((item) => item.text === feedPost.content).length === 1, 'Post translation cache missed')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Cá nhân/ }).click()
  await page.getByRole('switch', { name: 'Tự động dịch', exact: true }).waitFor()
  check(await page.locator('.appbar-search').count() === 0, 'Profile exposes a non-functional search')
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
  console.log('PASS: email-only signup/login, OTP error/resend, username identity, email search, malformed session, responsive auth/chat alignment, nearby flows, automatic feed/comment translation, original toggle/cache/fallback, threaded replies, parent payload, comment draft persistence/errors/pending send, profile, logout')
  return { passed: true, commentRequests, translationRequests: translations.length, errors }
}
