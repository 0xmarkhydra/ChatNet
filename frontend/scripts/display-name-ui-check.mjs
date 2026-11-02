import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: UserAvatar } = await vite.ssrLoadModule('/src/shared/ui/UserAvatar.tsx')
  const { default: FeedPostCard } = await vite.ssrLoadModule('/src/features/feed/FeedPostCard.tsx')
  const { default: StoryViewer } = await vite.ssrLoadModule('/src/features/feed/StoryViewer.tsx')
  const avatar = renderToStaticMarkup(createElement(UserAvatar, { name: 'Tên có dấu', username: 'account_a' }))
  assert.match(avatar, /aria-label="Tên có dấu"/)
  assert.match(avatar, /\/api\/users\/account_a\/avatar/)
  assert.doesNotMatch(avatar, /users\/T%C3%AAn/)
  const post = { id: 1, author: 'account_b', authorDisplayName: 'Tên trùng nhau', content: '', comments: [], likes: 0, liked: false, createdAt: '2026-01-01T00:00:00Z' }
  const card = renderToStaticMarkup(createElement(FeedPostCard, {
    post, name: 'account_a', ownDisplayName: 'Tên trùng nhau', apiFetch: async () => new Response('{}'),
    syncFeedPost() {}, removeFeedPost() {}, setNotice() {}, token: '', translationPreferencesLoaded: false,
    targetLanguage: '', setActivePostId() {}, likePreviews: {}, like: async () => {},
  }))
  assert.match(card, /<strong>Tên trùng nhau<\/strong>/)
  assert.match(card, /\/api\/users\/account_b\/avatar/)
  const legacy = renderToStaticMarkup(createElement(UserAvatar, { name: 'legacy_user' }))
  assert.match(legacy, /\/api\/users\/legacy_user\/avatar/)
  const story = renderToStaticMarkup(createElement(StoryViewer, {
    activeStory: { ...post, attachment: { kind: 'image', name: 'photo', url: 'https://example.invalid/photo.jpg' } },
    name: 'account_a', storyBusy: false, deleteStory: async () => {}, setActiveStoryId() {},
    nextStory() {}, previousStory() {}, activeStoryIndex: 0,
  }))
  assert.match(story, /Story của Tên trùng nhau/)
  assert.doesNotMatch(story, /aria-label="Xóa Story"/, 'A matching display label must not grant Story ownership')
  console.log('PASS: rendered Unicode labels, username avatar URLs, legacy fallback and duplicate-label Story ownership')
} finally {
  await vite.close()
}
