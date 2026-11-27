import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProfileTabs from './ProfileTabs'
import ProfileHero from './ProfileHero'
import ProfileDetailsCard from './ProfileDetailsCard'
import { UiLocaleContext, createUiTranslator } from '@/shared/i18n/locale'

describe('Profile shared presentation tokens', () => {
  it('uses the same semantic colors for accessible tab navigation', () => {
    const markup = renderToStaticMarkup(
      <ProfileTabs tabs={[{ id: 'posts', label: 'Bài viết' }, { id: 'about', label: 'Giới thiệu' }]}
        active="posts" onChange={() => {}} />,
    )
    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('aria-selected="true"')
    for (const utility of ['border-border-subtle', 'bg-card', 'text-muted-foreground', 'text-primary', 'hover:bg-accent']) {
      expect(markup).toContain(utility)
    }
    expect(markup).not.toContain('text-[#2563eb]')
  })

  it('retains profile summary and shared foreground colors', () => {
    const hero = renderToStaticMarkup(<ProfileHero displayName="Người dùng" username="demo" city="Hà Nội" avatar={<span>Avatar</span>} />)
    const details = renderToStaticMarkup(<ProfileDetailsCard username="demo" city="Hà Nội" friendCount={4} />)
    expect(hero).toContain('text-muted-foreground')
    expect(hero).toContain('Nơi sống')
    expect(details).toContain('text-foreground')
    expect(details).toContain('Có ')
    expect(details).not.toContain('text-[#17233d]')
  })
})

it('localizes the grouped desktop profile while preserving personal details', () => {
  for (const locale of ['vi', 'en', 'zh', 'ja', 'ko']) {
    const t = createUiTranslator(locale)
    const markup = renderToStaticMarkup(<UiLocaleContext.Provider value={{ locale }}>
      <ProfileDetailsCard grouped username="demo" city="Hà Nội" workplace="Đội sản phẩm" friendCount={4} hasPrivateEmail onEdit={() => {}} />
    </UiLocaleContext.Provider>)
    for (const value of [t('profile.personalInfo'), t('profile.work'), t('profile.education'), t('profile.friendCount', { count: 4 }), t('profile.privateEmail'), t('profile.editWork'), 'Hà Nội', 'Đội sản phẩm', '@demo']) expect(markup).toContain(value)
  }
})
