// Run against Vite preview with playwright-cli:
// playwright-cli run-code "$(cat frontend/scripts/layout-check.js)"
async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const context = await page.context().browser().newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 21.0285, longitude: 105.8542 },
    permissions: ['geolocation'],
  })
  const photo = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1000&q=80'
  const createdAt = new Date().toISOString()
  const posts = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1, author: 'minhanh', createdAt, likes: 12, liked: false, comments: [],
    content: 'Một buổi chiều bên hồ. Hẹn mọi người cuối tuần cùng đi dạo và khám phá những địa điểm mới.',
    attachments: [{ id: index + 1, kind: 'image', url: photo, name: 'Ho-nuoc.jpg' }],
  }))
  const errors = []
  const results = []
  try {
    await context.route('https://api-chat.codelocal.cloud/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', body: '' })
      const body = path === '/api/profile'
        ? { username: 'tester', displayName: 'Nguyễn Minh Anh', avatarSet: false, coverSet: false, updatedAt: createdAt }
        : path === '/api/preferences' ? { appLocale: 'vi', targetLanguage: 'vi', autoTranslate: false }
        : path === '/api/push/config' ? { configured: false, appId: '' }
        : path === '/api/posts' ? posts
        : path === '/api/stories' ? posts.map((post) => ({
          ...post, attachment: post.attachments[0], expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }))
        : path === '/api/translate' ? { translatedText: 'Nội dung thử nghiệm', sourceLanguage: 'vi' }
        : []
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    })
    let empty = false
    await context.route('https://overpass*/**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        elements: empty ? [] : Array.from({ length: 16 }, (_, index) => ({
          type: 'node', id: index + 1, lat: 21.0275 + index * 0.00025, lon: 105.852 + index * 0.0002,
          tags: { name: `Cà phê bên hồ ${index + 1}`, amenity: 'cafe', 'addr:street': 'Phố Đinh Tiên Hoàng' },
        })),
      }) })
    })
    await context.addInitScript(() => localStorage.setItem('chatnet-session', JSON.stringify({
      token: `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 86400 }))}.signature`,
      refreshToken: 'r'.repeat(43),
      user: { id: 1, email: 'test@example.com', username: 'tester', displayName: 'Nguyễn Minh Anh' },
    })))
    const p = await context.newPage()
    p.on('pageerror', (error) => errors.push(error.message))
    await p.goto('http://127.0.0.1:4173/')
    const nav = p.getByRole('navigation', { name: 'Điều hướng chính' })
    await nav.getByRole('button', { name: 'Quanh đây' }).click()
    await p.getByRole('button', { name: 'Địa điểm', exact: true }).click()
    await p.getByRole('button', { name: 'Dùng vị trí hiện tại' }).click()
    await p.getByRole('status').filter({ hasText: '16 địa điểm' }).waitFor()
    await p.locator('.maplibregl-canvas').waitFor()
    // Allow real map tiles to paint; API data and auth stay local fixtures.
    await p.waitForTimeout(5000)
    for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1280, 900]]) {
      await p.setViewportSize({ width, height })
      await p.waitForTimeout(1000)
      const map = await p.locator('.nearby-map').boundingBox()
      const navigation = await nav.boundingBox()
      assert(map.height >= height * 0.45, `Map too short at ${width}: ${map.height}`)
      assert(map.y + map.height <= navigation.y + 1, `Map overlaps navigation at ${width}`)
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`)
      await p.screenshot({ path: `output/playwright/layout-map-${width}.png` })
      results.push({ width, mapHeight: map.height, mapTop: map.y })
    }
    await p.setViewportSize({ width: 390, height: 844 })
    await p.getByRole('button', { name: 'Danh sách', exact: true }).click()
    await p.getByRole('button', { name: 'Xem Cà phê bên hồ 1 trên bản đồ', exact: true }).click()
    assert(await p.locator('.nearby-place-row.selected').isVisible(), 'Selected place missing')
    assert(await p.locator('.nearby-place-row:visible').count() === 1, 'Mobile shows unselected places')
    await p.screenshot({ path: 'output/playwright/layout-map-selected.png' })
    await p.getByRole('button', { name: 'Phóng to', exact: true }).click()
    await p.getByRole('button', { name: 'Về vị trí của tôi', exact: true }).click()
    await p.getByRole('textbox', { name: 'Tìm địa điểm' }).fill('khong-khop')
    await p.getByRole('status').filter({ hasText: '0 địa điểm' }).waitFor()
    assert(await p.locator('.nearby-place-row:visible').count() === 0, 'Stale selected place')
    await p.getByRole('textbox', { name: 'Tìm địa điểm' }).fill('')
    empty = true
    await p.getByRole('button', { name: 'Tìm lại', exact: true }).click()
    await p.getByRole('status').filter({ hasText: '0 địa điểm' }).waitFor()
    await p.getByRole('button', { name: 'Danh sách', exact: true }).click()
    assert(await p.getByRole('heading', { name: 'Chưa tìm thấy địa điểm' }).isVisible(), 'Empty state missing')
    for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1280, 900]]) {
      await p.setViewportSize({ width, height })
      await nav.getByRole('button', { name: 'Bảng tin' }).click()
      await p.locator('.zalo-post').first().waitFor()
      await p.waitForFunction(() => {
        const images = [...document.querySelectorAll('.stories-strip img, .zalo-post:first-child img')]
        return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0)
      })
      await p.waitForTimeout(300)
      await p.getByRole('textbox', { name: 'Nội dung bài viết' }).fill('Bài viết thử nghiệm chưa gửi')
      const input = await p.getByRole('textbox', { name: 'Nội dung bài viết' }).boundingBox()
      const submit = await p.getByRole('button', { name: 'Đăng', exact: true }).boundingBox()
      assert(submit.y >= input.y + input.height, 'Submit overlaps composer')
      const post = await p.locator('.zalo-post').first().boundingBox()
      assert(post.width <= 722, 'Feed stretches too wide')
      const avatar = await p.locator('.zalo-post > .avatar').first().boundingBox()
      const author = await p.locator('.zalo-post .post-author').first().boundingBox()
      assert(Math.abs(avatar.y - author.y) < 2, 'Avatar detached from author')
      await p.screenshot({ path: `output/playwright/layout-feed-${width}.png` })
      await p.locator('.feed-view').evaluate((el) => { el.scrollTop = el.scrollHeight })
      await p.locator('.zalo-post').last().locator('.post-toolbar').scrollIntoViewIfNeeded()
      await p.waitForTimeout(300)
      await p.locator('.feed-view').evaluate((el) => { el.scrollTop = el.scrollHeight })
      const lastPost = await p.locator('.zalo-post').last().boundingBox()
      const feed = await p.locator('.feed-view').boundingBox()
      assert(lastPost.y < feed.y + feed.height && lastPost.y + lastPost.height <= feed.y + feed.height + 1, `Cannot reach last post: ${JSON.stringify({ width, lastPost, feed })}`)
      await nav.getByRole('button', { name: 'Cá nhân' }).click()
      await p.locator('.profile-view').waitFor()
      await p.waitForTimeout(300)
      const form = await p.locator('.profile-edit-card').boundingBox()
      const settings = await p.locator('.settings-card').boundingBox()
      assert(width < 900 ? settings.y >= form.y + form.height - 1 : settings.x >= form.x + form.width - 1, 'Profile columns overlap')
      await p.screenshot({ path: `output/playwright/layout-profile-${width}.png` })
      await p.locator('.profile-view').evaluate((el) => { el.scrollTop = el.scrollHeight })
      await p.locator('.profile-actions').scrollIntoViewIfNeeded()
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Profile overflow at ${width}`)
    }
    assert(errors.length === 0, errors.join('\n'))
    return { passed: true, results }
  } finally {
    await context.close()
  }
}
