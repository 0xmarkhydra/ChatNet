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
