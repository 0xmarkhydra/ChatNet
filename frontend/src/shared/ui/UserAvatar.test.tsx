// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import UserAvatar from './UserAvatar'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

afterEach(() => {
  document.body.innerHTML = ''
})

it('exposes one accessible avatar label without announcing decorative initials', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<UserAvatar name="Nguyễn An" username="nguyen-an" />)
  })

  const avatar = host.querySelector('[role="img"]')
  expect(avatar?.getAttribute('aria-label')).toBe('Nguyễn An')
  expect(avatar?.querySelector('.avatar-initials')?.getAttribute('aria-hidden')).toBe('true')
  expect(avatar?.querySelector('img')?.getAttribute('alt')).toBe('')
  await act(async () => root.unmount())
})

it('keeps group placeholder decorative and the group name accessible', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<UserAvatar name="Nhóm kỹ thuật" group />)
  })
  const avatar = host.querySelector('[role="img"]')
  expect(avatar?.getAttribute('aria-label')).toBe('Nhóm kỹ thuật')
  expect(avatar?.querySelector('.avatar-initials')?.getAttribute('aria-hidden')).toBe('true')
  await act(async () => root.unmount())
})
