import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Card } from '../src/shared/ui/card'
import { PostCardEngagement, PostCardHeader } from '../src/features/feed/components/PostCardSections'
import type { Post } from '../src/features/feed/types'

vi.mock('../src/features/feed/components/FeedPostActions', () => ({
  default: () => <button type="button" aria-label="Tùy chọn bài viết">•••</button>,
}))
vi.mock('../src/shared/ui/UserAvatar', () => ({
  default: ({ username }: { username: string }) => <img src="/placeholder.svg" alt={username} className="avatar" />,
}))

const post: Post = {
  id: 4, author: 'owner', authorDisplayName: 'Người đăng',
  content: 'Hehee', likes: 1, liked: true, comments: [],
  visibility: 'private', createdAt: '2026-11-19T10:00:00.000Z',
}
const actions = {
  apiFetch: vi.fn(async () => new Response(null, { status: 200 })),
  syncFeedPost: vi.fn(),
  removeFeedPost: vi.fn(),
  setNotice: vi.fn(),
}

describe('unified PostCard markup', () => {
  it('Card asChild retains article semantics and does not add a wrapper', () => {
    const html = renderToStaticMarkup(<Card asChild><article aria-label="Bài viết">Nội dung</article></Card>)
    expect(html.startsWith('<article')).toBe(true)
    expect(html).toContain('data-slot="card"')
    expect(html).toContain('rounded-ui-lg')
    expect(html).not.toContain('<section')
  })

  it('existing Card remains a section by default', () => {
    const html = renderToStaticMarkup(<Card>Thông tin</Card>)
    expect(html.startsWith('<section')).toBe(true)
  })

  it('PostCard header contains a single aligned avatar, author metadata and options', () => {
    const html = renderToStaticMarkup(<PostCardHeader post={post} authorLabel="Người đăng" name="owner" openPost={() => {}} {...actions} />)
    expect(html).toContain('<header')
    expect(html).toContain('post-card-header')
    expect(html).toMatch(/<header class="[^"]*\bflex\b/)
    expect(html).toContain('alt="owner"')
    expect(html).toContain('Người đăng')
    expect(html).toContain('Chỉ mình tôi')
    expect(html).toContain('Tùy chọn bài viết')
    expect(html).not.toContain('col-start-2!')
    expect(html).not.toContain('contents!')
  })

  it('engagement summary preserves reaction and comment counts', () => {
    const html = renderToStaticMarkup(<PostCardEngagement post={post} onReactionUsers={() => {}} />)
    expect(html).toContain('1 lượt thích')
    expect(html).toContain('0 bình luận')
    expect(html).toContain('Xem 1 người bày tỏ cảm xúc')
    expect(html).not.toContain('disabled=""')
  })

  it('reaction list is disabled for posts without reactions', () => {
    const html = renderToStaticMarkup(<PostCardEngagement post={{ ...post, likes: 0 }} onReactionUsers={() => {}} />)
    expect(html).toContain('disabled=""')
  })
})
