import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import FeedPostsFallback from './FeedPostsFallback'

describe('Feed first-page loading fallback', () => {
  it('announces loading and never invents post content or actions', () => {
    const html = renderToStaticMarkup(<FeedPostsFallback />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Đang tải bài viết')
    expect(html).toContain('motion-safe:animate-pulse')
    expect(html).not.toContain('<button')
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(2)
  })
})
