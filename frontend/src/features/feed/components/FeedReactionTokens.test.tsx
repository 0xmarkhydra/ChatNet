import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import FeedLikeButton from './FeedLikeButton'

vi.mock('../utils/postHeartBurst', () => ({ burstPostHearts: vi.fn() }))

describe('Feed reaction semantic tokens', () => {
  it('keeps pressed state and liked visual color independent of primary', () => {
    const markup = renderToStaticMarkup(<FeedLikeButton post={{ liked: true, myReaction: '❤️' }} busy={false} onLike={() => {}} />)
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('text-reaction-like!')
    expect(markup).toContain('hover:bg-reaction-like-hover!')
    expect(markup).toContain('Đã thích')
  })

  it('does not mark an unliked post as pressed', () => {
    const markup = renderToStaticMarkup(<FeedLikeButton post={{ liked: false, myReaction: undefined }} busy={true} onLike={() => {}} />)
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('disabled')
    expect(markup).not.toContain('text-reaction-like!')
  })
})
