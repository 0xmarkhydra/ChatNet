import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('post composer CSS ownership', () => {
  it('renders one Tailwind-owned shared launcher for Feed and Profile', () => {
    const launcher = readSource('../src/shared/ui/PostComposerLauncher.tsx')
    const feed = readSource('../src/features/feed/components/SocialFeedComposer.tsx')
    const profile = readSource('../src/features/profile/components/ProfilePage.tsx')
    expect(launcher).toContain('className="box-border flex w-full')
    expect(feed).toContain('<PostComposerLauncher')
    expect(profile).toContain('<PostComposerLauncher')
    expect(launcher).not.toContain('social-feed-launcher')
    expect(launcher).not.toContain('profile-page-composer')
  })

  it('keeps page-level button states off the shared launcher', () => {
    const feedCss = readSource('../src/features/feed/styles/social-feed.css')
    const profileCss = readSource('../src/features/profile/styles/profile-page.css')
    expect(feedCss).not.toMatch(/\.social-feed\s+button:(?:focus-visible|disabled)/)
    expect(profileCss).not.toMatch(/\.profile-page\s+button:(?:focus-visible|disabled)/)
    expect(profileCss).not.toContain('.profile-page-composer button')
  })
})
