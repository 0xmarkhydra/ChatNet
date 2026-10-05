// With Vite running: playwright-cli open http://127.0.0.1:5174
// playwright-cli run-code --filename frontend/scripts/connections-smoke.js
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message) }
  const origin = new URL(page.url()).origin
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const friend = { id: 2, username: 'minhanh', displayName: 'Minh Anh', online: true }
  const session = { token: 'connections-test-only', user: { id: 1, username: 'tester', displayName: 'Người kiểm thử', email: 'test@example.com' } }
  let groups = []
  let groupFailure = true
  let nearbyFailure = false
  const requests = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' })
    if (path.endsWith('/avatar') || path.endsWith('/cover')) return route.fulfill({ status: 404, body: '' })
    if (path === '/api/profile') return json({ ...session.user, avatarSet: false, coverSet: false })
    if (path === '/api/preferences') return json({ autoTranslate: false, targetLanguage: 'vi', appLocale: 'vi' })
    if (path === '/api/i18n/bundle') return json(request.postDataJSON())
    if (path === '/api/friends') return json([{ ...friend, status: 'accepted' }])
    if (path === '/api/users/search') return json(new URL(request.url()).searchParams.get('q') === 'Minh Anh' ? [] : [friend])
    if (path === '/api/users/suggestions') return json([friend])
    if (path === '/api/conversations/groups') {
      const body = request.postDataJSON()
      requests.push({ path, body })
      await new Promise((resolve) => setTimeout(resolve, 200))
      if (groupFailure) return json({ error: 'Lỗi thử nghiệm tạo nhóm' }, 503)
      const group = { id: 11, ...body, type: 'group', memberCount: 2, unreadCount: 0, lastMessage: '', createdAt: new Date().toISOString() }
      groups = [group]
      return json(group, 201)
    }
    if (path === '/api/conversations') return json(groups)
    if (path === '/api/users/nearby') {
      requests.push({ path, method: request.method(), body: request.postData() })
      if (nearbyFailure) return json({ error: 'Unavailable' }, 503)
      if (request.method() === 'DELETE') return json({ ok: true })
      return json({ users: [{ ...friend, distanceKm: 1.3 }, { id: 3, username: 'hoangnam', displayName: 'Hoàng Nam', online: false, distanceKm: .4 }],
        expiresAt: new Date(Date.now() + 900000).toISOString() })
    }
    return json([])
  })
  await page.route('https://overpass-*/**', (route) => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ elements: [{ type: 'node', id: 22, lat: 10.775, lon: 106.701, tags: { name: 'Cà phê kiểm thử', amenity: 'cafe' } }] }) }))
  await page.addInitScript(() => {
    window.geoCalls = 0
    window.geoDenied = true
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(resolve, reject) {
      window.geoCalls++
      if (window.geoDenied) reject({ code: 1 })
      else resolve({ coords: { latitude: 10.776, longitude: 106.7 } })
    } } })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError') } })
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.sharedText = text } } })
  })
  await page.evaluate((value) => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
  await page.reload()
  await page.getByRole('button', { name: 'Danh bạ', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Quét QR', exact: true }).click()
  const qr = page.getByRole('dialog', { name: 'Kết nối bằng QR' })
  await qr.getByRole('button', { name: 'QR của tôi', exact: true }).click()
  await qr.locator('.qr-image img').waitFor()
  const decoded = await page.evaluate(async () => {
    const { default: Scanner } = await import('/node_modules/.vite/deps/qr-scanner.js')
    return (await Scanner.scanImage(document.querySelector('.qr-image img').src, { returnDetailedScanResult: true })).data
  })
  check(decoded === `${origin}/?connect=tester`, 'Generated QR contains wrong profile')
  await qr.getByRole('button', { name: 'Chia sẻ QR' }).click()
  await page.waitForFunction(() => window.sharedText)
  check(await page.evaluate(() => window.sharedText) === decoded, 'QR share fallback lost URL')
  check(await qr.getByRole('link', { name: 'Tải ảnh QR' }).getAttribute('download') === 'chatnet-tester.png', 'Missing QR download')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'output/playwright/qr-mobile.png' })
  await qr.getByRole('button', { name: 'Quét QR', exact: true }).click()
  await qr.getByRole('button', { name: 'Bật camera' }).click()
  await qr.getByText('Không mở được camera.', { exact: false }).waitFor()
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 720
      const stream = canvas.captureStream(5)
      window.cameraTracks = stream.getTracks()
      return stream
    } })
  })
  await qr.getByRole('button', { name: 'Bật camera' }).click()
  await page.waitForFunction(() => document.querySelector('.qr-camera video')?.srcObject)
  await qr.getByRole('button', { name: 'QR của tôi', exact: true }).click()
  await page.waitForFunction(() => window.cameraTracks.every((track) => track.readyState === 'ended'))
  await qr.getByRole('button', { name: 'Quét QR', exact: true }).click()
  await qr.getByRole('button', { name: 'Bật camera' }).click()
  await page.waitForFunction(() => document.querySelector('.qr-camera video')?.srcObject)
  await qr.getByRole('button', { name: 'Đóng QR' }).click()
  await page.waitForFunction(() => window.cameraTracks.every((track) => track.readyState === 'ended'))
  await page.getByRole('button', { name: 'Quét QR', exact: true }).click()
  const uploadQr = async (value) => {
    const data = await page.evaluate(async (text) => {
      const { default: QRCode } = await import('/node_modules/.vite/deps/qrcode.js')
      return QRCode.toDataURL(text, { width: 720 })
    }, value)
    await qr.locator('input[type=file]').setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: Buffer.from(data.split(',')[1], 'base64') })
  }
  await uploadQr('https://example.com/?connect=minhanh')
  await qr.getByText('Mã QR không phải hồ sơ ChatNet', { exact: false }).waitFor()
  await uploadQr(`${origin}/?connect=tester`)
  await qr.getByText('Đây là mã QR của bạn.').waitFor()
  await uploadQr(`${origin}/?connect=minhanh&connect=other`)
  await qr.getByText('Mã QR không chứa hồ sơ hợp lệ.').waitFor()
  await uploadQr(`${origin}/?connect=minhanh`)
  await qr.getByRole('button', { name: 'Xem hồ sơ @minhanh' }).click()
  await page.getByRole('dialog', { name: 'Kết nối', exact: true }).waitFor()
  check(await page.getByRole('textbox', { name: 'Tìm bạn bằng tên, username hoặc email' }).inputValue() === 'minhanh', 'Scanned identity not passed to friend search')
  await page.getByRole('dialog', { name: 'Kết nối', exact: true }).getByRole('button', { name: 'Đóng tìm và kết nối', exact: true }).click()

  await page.getByRole('button', { name: 'Danh bạ', exact: true }).click()
  await page.getByRole('button', { name: /Nhóm và cộng đồng/ }).click()
  const group = page.getByRole('dialog', { name: 'Tạo nhóm', exact: true })
  check(await group.getByRole('button', { name: 'Tạo nhóm', exact: true }).isDisabled(), 'Empty group allowed')
  const nameSearch = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/users/search'
    && new URL(response.url()).searchParams.get('q') === 'Minh Anh')
  await group.getByRole('textbox', { name: 'Thêm thành viên' }).fill('Minh Anh')
  await nameSearch
  await group.getByRole('checkbox', { name: 'Chọn Minh Anh' }).waitFor()
  check(await group.getByRole('checkbox', { name: 'Chọn Minh Anh' }).count() === 1, 'Local display-name search missing or duplicated')
  await group.getByRole('checkbox', { name: 'Chọn Minh Anh' }).check()
  await group.getByRole('button', { name: 'Tạo nhóm · 2 người' }).click()
  check(await group.getByRole('button', { name: 'Đang tạo...' }).isDisabled(), 'Duplicate submission allowed')
  await group.getByRole('alert').waitFor()
  check(await group.getByRole('checkbox', { name: 'Chọn Minh Anh' }).isChecked(), 'Failed creation lost selection')
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    check(await group.evaluate((node) => node.scrollWidth <= node.clientWidth), `Group overflow at ${width}`)
    await page.screenshot({ path: `output/playwright/group-${width}.png` })
  }
  groupFailure = false
  await group.getByRole('button', { name: 'Tạo nhóm · 2 người' }).click()
  await group.waitFor({ state: 'detached' })
  check(groups.length === 1 && groups[0].usernames.length === 1 && groups[0].usernames[0] === 'minhanh', 'Group must send exactly one invited member')
  check(groups[0].name === 'Nhóm Minh Anh', 'Default group name missing')
  check(requests.filter((item) => item.path.endsWith('/groups')).length === 2, 'Unexpected group requests')

  await page.getByRole('button', { name: 'Quanh đây', exact: true }).click()
  await page.getByRole('heading', { name: 'Quanh đây', exact: true }).waitFor()
  check(await page.evaluate(() => window.geoCalls) === 0, 'Location requested before consent')
  await page.getByRole('button', { name: 'Bật và tìm người' }).click()
  await page.getByRole('button', { name: 'Bật và tìm người' }).waitFor()
  check(requests.filter((item) => item.path.endsWith('/nearby')).length === 0, 'Denied location sent to API')
  await page.evaluate(() => { window.geoDenied = false })
  await page.getByRole('button', { name: 'Bật và tìm người' }).click()
  await page.locator('.nearby-person').first().waitFor()
  check(await page.locator('.nearby-person strong').first().textContent() === 'Hoàng Nam', 'Distance ordering wrong')
  await page.getByRole('textbox', { name: 'Tìm người quanh đây' }).fill('Minh Anh')
  check(await page.locator('.nearby-person').count() === 1, 'Display-name search broken')
  await page.getByRole('textbox', { name: 'Tìm người quanh đây' }).fill('')
  const oldRadius = await page.locator('.nearby-results-heading > span').textContent()
  await page.getByRole('combobox', { name: 'Bán kính tìm kiếm' }).selectOption('25')
  nearbyFailure = true
  await page.getByRole('button', { name: 'Tìm lại', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.nearby-refresh').disabled)
  check(await page.locator('.nearby-results-heading > span').textContent() === oldRadius, 'Failed refresh mislabeled results')
  await page.getByRole('switch', { name: 'Hiển thị quanh đây' }).click()
  await page.waitForFunction(() => !document.querySelector('[aria-label="Hiển thị quanh đây"]').disabled)
  check(await page.getByRole('switch', { name: 'Hiển thị quanh đây' }).isChecked(), 'Failed stop falsely hid location')
  nearbyFailure = false
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    check(await page.locator('.nearby-explorer').evaluate((node) => node.scrollWidth <= node.clientWidth), `Nearby overflow at ${width}`)
    await page.screenshot({ path: `output/playwright/nearby-${width}.png` })
  }
  await page.getByRole('switch', { name: 'Hiển thị quanh đây' }).click()
  await page.getByRole('button', { name: 'Bật và tìm người' }).waitFor()
  check(await page.locator('.nearby-person').count() === 0, 'Stopped sharing retained results')
  await page.getByRole('button', { name: 'Địa điểm', exact: true }).click()
  await page.getByRole('button', { name: 'Dùng vị trí hiện tại' }).click()
  await page.getByText('Cà phê kiểm thử', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cà phê', exact: true }).click()
  await page.getByText('Cà phê kiểm thử', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Bản đồ', exact: true }).click()
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    const bounds = await page.locator('.nearby-map-canvas').boundingBox()
    check(bounds && bounds.height >= 300, `Map clipped at ${width}`)
    check(await page.locator('.nearby-place-marker').count() === 1, 'Missing place marker')
  }
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`)
  return { passed: true, groupRequests: 2, errors }
}
