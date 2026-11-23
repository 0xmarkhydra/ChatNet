import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const theme = readFileSync(new URL('../../../styles/soco-theme.css', import.meta.url), 'utf8')

describe('contacts and auth primary color migration', () => {
  it('retains the approved blue color in the central token', () => {
    expect(theme).toContain('--soco-blue: #2563eb;')
  })

  it.each([
    '../../contacts/styles/contacts-overview.css',
    '../../contacts/styles/friends-design-v2.css',
    '../../contacts/styles/unified-contacts.css',
    '../../auth/styles/auth-screen.css',
  ])('uses the existing primary token rather than a duplicate hex in %s', path => {
    const css = readFileSync(new URL(path, import.meta.url), 'utf8')
    expect(css).not.toContain('#2563eb')
    expect(css).toContain('var(--soco-blue)')
  })
})
