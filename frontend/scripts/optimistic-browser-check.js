// playwright-cli run-code "$(cat frontend/scripts/optimistic-browser-check.js)"
async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })
  const createdAt = new Date().toISOString()
  const initial = {
    token: `header.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 86400 })).toString('base64url')}.signature`,
    refreshToken: 'r'.repeat(43), sessionId: 'optimistic-test',
    user: { id: 1, email: 'test@example.com', username: 'tester', displayName: 'Test' },
  }
  let posts = [{ id: 10, author: 'tester', content: 'Existing post', likes: 0, liked: false, comments: [], attachments: [], createdAt }]
  const conversations = [1, 2].map((id) => ({
    id, type: 'direct', name: `Friend ${id}`, memberCount: 2, unreadCount: 0, lastMessage: '', online: true, createdAt,
  }))
  const firstMessage = { id: 20, conversationId: 1, senderId: 2, sender: 'friend', text: 'Hello', createdAt, reactions: [{ emoji: '❤️', count: 1, mine: false }] }
  const messages = { 1: [firstMessage], 2: [] }
  const queued = new Map()
  const counts = new Map()
  const errors = []
  let deferMessages = false
  let p
  const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const take = async (key) => {
    for (let i = 0; i < 100 && !queued.has(key); i++) await p.waitForTimeout(20)
    assert(queued.has(key), `Missing request ${key}`)
    const route = queued.get(key)
    queued.delete(key)
    return route
  }
  try {
    await context.addInitScript(() => {
      window.EventSource = class extends EventTarget {
        constructor() { super(); window.testEvents = this }
        close() {}
      }
    })
    await context.route('https://api-chat.codelocal.cloud/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (deferMessages && method === 'GET' && path.endsWith('/messages')) {
        queued.set(`${method} ${path}`, route)
        return
      }
      if (method !== 'GET' && !/\/(read|translate|subscription)$/.test(path)) {
        const key = `${method} ${path}`
        counts.set(key, (counts.get(key) || 0) + 1)
        queued.set(key, route)
        return
      }
      if (path.endsWith('/messages')) return reply(route, messages[path.includes('/1/') ? 1 : 2])
      const body = path === '/api/profile'
        ? { ...initial.user, avatarSet: false, coverSet: false, updatedAt: createdAt }
        : path === '/api/preferences' ? { appLocale: 'vi', targetLanguage: 'vi', autoTranslate: false }
        : path === '/api/push/config' ? { configured: false, appId: '' }
        : path === '/api/posts' ? posts
        : path === '/api/conversations' ? conversations
        : path === '/api/translate' ? { translatedText: route.request().postDataJSON().text }
        : []
      return reply(route, body)
    })
    p = await context.newPage()
    p.on('pageerror', (error) => errors.push(error.message))
    await p.goto('http://127.0.0.1:4173/')
    await p.evaluate((session) => localStorage.setItem('chatnet-session', JSON.stringify(session)), initial)
    await p.reload()
    const nav = p.getByRole('navigation', { name: 'Điều hướng chính' })
    await nav.getByRole('button', { name: 'Bảng tin' }).click()
    const like = p.locator('.zalo-post').first().getByRole('button', { name: /Thích/ })
    await like.click()
    const likeRoute = await take('POST /api/posts/10/like')
    assert(await like.getAttribute('aria-pressed') === 'true', 'Like not immediate')
    assert(await like.isDisabled(), 'Like not locked')
    assert((await like.innerText()).includes('1'), 'Like count not immediate')
    await like.evaluate((button) => button.click())
    assert(counts.get('POST /api/posts/10/like') === 1, 'Duplicate like')
    await reply(likeRoute, { error: 'Like rejected' }, 500)
    await p.waitForFunction(() => document.querySelector('.zalo-post .post-toolbar button')?.getAttribute('aria-pressed') === 'false')
    assert(await like.isEnabled(), 'Like stayed locked after failure')

    const input = p.getByRole('textbox', { name: 'Nội dung bài viết' })
    await input.fill('Draft survives network error')
    await p.getByRole('button', { name: 'Đăng', exact: true }).click()
    const postRoute = await take('POST /api/posts')
    assert(await p.locator('.zalo-post.outgoing-preview').isVisible(), 'Post preview missing')
    assert(await input.isDisabled(), 'Post composer not frozen')
    for (const [width, height] of [[390, 844], [1280, 900]]) {
      await p.setViewportSize({ width, height })
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow')
      await p.screenshot({ path: `output/playwright/optimistic-feed-${width}.png` })
    }
    await postRoute.abort('internetdisconnected')
    await p.locator('.zalo-post.outgoing-preview').waitFor({ state: 'hidden' })
    assert(await input.inputValue() === 'Draft survives network error', 'Failed post lost draft')
    await p.getByRole('button', { name: 'Đăng', exact: true }).click()
    const postRetry = await take('POST /api/posts')
    const posted = { ...posts[0], id: 11, content: 'Draft survives network error' }
    posts = [posted, ...posts]
    await reply(postRetry, posted)
    await p.waitForFunction(() => document.querySelector('[aria-label="Nội dung bài viết"]')?.value === '')
    assert(await p.locator('.zalo-post').count() === 2, 'Post duplicated')

    await p.locator('.zalo-post').last().locator('.post-detail-trigger').click()
    const comment = p.getByRole('textbox', { name: 'Viết bình luận' })
    await comment.fill('Comment draft')
    await p.getByRole('button', { name: 'Gửi bình luận', exact: true }).click()
    const commentRoute = await take('POST /api/posts/10/comments')
    assert(await p.locator('.feed-discussion .outgoing-preview').isVisible(), 'Comment preview missing')
    await reply(commentRoute, { error: 'Unavailable' }, 500)
    await p.getByRole('button', { name: 'Gửi bình luận', exact: true }).waitFor()
    assert(await comment.inputValue() === 'Comment draft', 'Failed comment lost draft')
    await p.getByRole('button', { name: 'Gửi bình luận', exact: true }).click()
    const commentSuccess = await take('POST /api/posts/10/comments')
    const dialogLike = p.locator('[role="dialog"]').getByRole('button', { name: /Thích/ })
    await dialogLike.click()
    const parallelLike = await take('POST /api/posts/10/like')
    posts[1] = { ...posts[1], liked: true, likes: 1 }
    await reply(parallelLike, posts[1])
    const newComment = { id: 40, author: 'tester', content: 'Comment draft', createdAt }
    posts[1] = { ...posts[1], comments: [newComment] }
    await reply(commentSuccess, { ...posts[1], liked: false, likes: 0 })
    await p.waitForFunction(() => document.querySelector('[aria-label="Viết bình luận"]')?.value === '')
    assert(await dialogLike.getAttribute('aria-pressed') === 'true', 'Comment overwrote concurrent like')
    await p.getByRole('button', { name: 'Đóng chi tiết bài viết', exact: true }).click()
    await nav.getByRole('button', { name: 'Tin nhắn', exact: true }).click()
    deferMessages = true
    await p.locator('.conversation-item').filter({ hasText: 'Friend 1' }).click()
    const history = await take('GET /api/conversations/1/messages')
    await p.evaluate((message) => window.testEvents.dispatchEvent(new MessageEvent('update', {
      data: JSON.stringify({ type: 'message.updated', conversationId: 1, message }),
    })), { ...firstMessage, text: 'Edited before history' })
    await p.evaluate((message) => window.testEvents.dispatchEvent(new MessageEvent('update', {
      data: JSON.stringify({ type: 'message', conversationId: 1, message }),
    })), { ...firstMessage, id: 19, text: 'Arrived before history', reactions: [] })
    deferMessages = false
    await reply(history, [firstMessage])
    await p.locator('.message-press-target').first().waitFor()
    await p.waitForTimeout(200)
    assert(await p.locator('.messages').getByText('Edited before history', { exact: true }).count() === 1, 'History overwrote realtime edit')
    assert(await p.locator('.messages').getByText('Arrived before history', { exact: true }).count() === 1, 'History lost realtime message')
    const reaction = p.locator('.message-press-target').filter({ hasText: 'Edited before history' })
      .getByRole('button', { name: 'Thả cảm xúc ❤️', exact: true })
    await reaction.click()
    const reactionRoute = await take('POST /api/messages/20/reactions')
    assert((await reaction.innerText()).includes('2'), 'Reaction not immediate')
    await p.evaluate((message) => window.testEvents.dispatchEvent(new MessageEvent('update', {
      data: JSON.stringify({ type: 'message.updated', conversationId: 1, message }),
    })), { ...firstMessage, text: 'Edited before history', reactions: [{ emoji: '❤️', count: 2, mine: false }] })
    assert((await reaction.innerText()).includes('2'), 'Realtime doubled optimistic reaction')
    await reply(reactionRoute, { ...firstMessage, text: 'Edited before history', reactions: [{ emoji: '❤️', count: 2, mine: true }] })
    await p.waitForFunction(() => !document.querySelector('.reaction-chip')?.disabled)
    assert((await reaction.innerText()).includes('2'), 'Reaction count changed after ack')

    const messageInput = p.getByRole('textbox', { name: 'Tin nhắn', exact: true })
    const send = p.getByRole('button', { name: 'Gửi tin nhắn', exact: true })
    await messageInput.fill('Immediate message')
    await send.click()
    const sendRoute = await take('POST /api/conversations/1/messages')
    assert(await p.locator('.messages .outgoing-preview').isVisible(), 'Message preview missing')
    const sent = { ...firstMessage, id: 21, senderId: 1, sender: 'tester', text: 'Immediate message', reactions: [], clientId: sendRoute.request().postDataJSON().clientId }
    await p.evaluate((message) => window.testEvents.dispatchEvent(new MessageEvent('update', {
      data: JSON.stringify({ type: 'message', conversationId: 1, message }),
    })), sent)
    await p.locator('.messages .outgoing-preview').waitFor({ state: 'hidden' })
    await sendRoute.abort('internetdisconnected')
    await p.waitForFunction(() => document.querySelector('[aria-label="Tin nhắn"]')?.value === '')
    assert(await p.locator('.message-press-target').filter({ hasText: 'Immediate message' }).count() === 1, 'Realtime receipt duplicated')
    await messageInput.fill('Keep failed message')
    await send.click()
    await (await take('POST /api/conversations/1/messages')).abort('internetdisconnected')
    await p.waitForFunction(() => !document.querySelector('[aria-label="Tin nhắn"]')?.disabled)
    assert(await messageInput.inputValue() === 'Keep failed message', 'Failed message lost draft')
    await send.click()
    const switched = await take('POST /api/conversations/1/messages')
    await p.locator('.conversation-item').filter({ hasText: 'Friend 2' }).click()
    await reply(switched, { ...sent, id: 22, text: 'Keep failed message', clientId: switched.request().postDataJSON().clientId })
    await p.waitForFunction(() => !document.querySelector('[aria-label="Tin nhắn"]')?.disabled)
    assert(await p.locator('.messages').getByText('Keep failed message', { exact: true }).count() === 0, 'Message leaked across conversations')
    await nav.getByRole('button', { name: 'Cá nhân' }).click()
    const autoTranslate = p.getByRole('switch', { name: 'Tự động dịch tin nhắn', exact: true })
    await autoTranslate.click()
    const preferenceFirst = await take('PUT /api/preferences')
    assert(await autoTranslate.getAttribute('aria-checked') === 'true', 'Preference not immediate')
    await autoTranslate.click()
    assert(await autoTranslate.getAttribute('aria-checked') === 'false', 'Latest preference not immediate')
    assert(counts.get('PUT /api/preferences') === 1, 'Preference writes not serialized')
    await reply(preferenceFirst, { autoTranslate: true })
    const preferenceLast = await take('PUT /api/preferences')
    assert(preferenceLast.request().postDataJSON().autoTranslate === false, 'Lost newest preference')
    await reply(preferenceLast, { autoTranslate: false })
    await nav.getByRole('button', { name: 'Tin nhắn', exact: true }).click()
    await p.locator('.conversation-item').filter({ hasText: 'Friend 2' }).click()
    await messageInput.fill('Logout during send')
    await send.click()
    const stale = await take('POST /api/conversations/2/messages')
    await nav.getByRole('button', { name: 'Cá nhân' }).click()
    await p.getByRole('button', { name: /Đăng xuất/ }).click()
    await reply(stale, { ...sent, id: 23, conversationId: 2 })
    await nav.waitFor({ state: 'hidden' })
    assert(await p.locator('.request-progress').count() === 0, 'Pending status survived logout')
    assert(errors.length === 0, errors.join('\n'))
    return { passed: true, checks: 'immediate previews, duplicate clicks, network rollback, draft retention, concurrent fields, realtime/history/HTTP race, serialized preferences, conversation switch, logout', counts: Object.fromEntries(counts) }
  } finally {
    await context.close()
  }
}
