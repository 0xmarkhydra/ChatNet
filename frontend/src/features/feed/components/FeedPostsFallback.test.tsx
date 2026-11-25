import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import FeedPostsFallback from './FeedPostsFallback'

describe('Feed loading surface design tokens', () => {
  it('uses the shared spacing and 44px avatar dimension without changing loading semantics', () => {
    const markup = renderToStaticMarkup(<FeedPostsFallback />)
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('gap-ui-3')
    expect(markup).toContain('gap-ui-2')
    expect(markup).toContain('size-control-touch')
    expect(markup).toContain('bg-card')
    expect((markup.match(/motion-safe:animate-pulse/g) ?? [])).toHaveLength(2)
  })
})
