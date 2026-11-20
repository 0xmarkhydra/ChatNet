import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import ProfileHero from './ProfileHero'

const identity = { username: 'demo', displayName: 'Demo', avatar: null }

it('shows only the profile details that have a value', () => {
  const details = renderToStaticMarkup(<ProfileHero {...identity}
    friendCount={288} city="  Hòa Bình  " workplace="Đội sản phẩm" school="Trường Công nghệ" />)
  expect(details).toContain('288 người bạn')
  for (const value of ['Hòa Bình', 'Đội sản phẩm', 'Trường Công nghệ']) expect(details).toContain(value)

  const empty = renderToStaticMarkup(<ProfileHero {...identity} friendCount={0} city=" " />)
  expect(empty).not.toContain('người bạn')
  expect(empty).not.toContain('profile-page-identity-details')
})

it('uses the account tone for an optional mobile cover but preserves a real cover', () => {
  expect(renderToStaticMarkup(<ProfileHero {...identity} fallbackCoverTone={0} />)).toContain('has-account-cover avatar-tone-0')
  const photo = renderToStaticMarkup(<ProfileHero {...identity} fallbackCoverTone={3} coverUrl="/cover.jpg" />)
  expect(photo).toContain('has-user-cover')
  expect(photo).toContain('src="/cover.jpg"')
  expect(photo).not.toContain('has-account-cover')
  expect(renderToStaticMarkup(<ProfileHero {...identity} />)).toContain('has-default-cover')
})
