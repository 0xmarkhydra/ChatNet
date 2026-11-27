// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { SessionContext } from '../../../shared/context/SessionContext'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { Story } from '../types'
import { markStorySeen } from '../utils/storySeen'
import { avatarStoryStatuses, useAvatarStoryStatuses } from './useAvatarStoryStatuses'

const story = (id: number, expiresAt: string, author = 'an'): Story => ({
  id, author, authorDisplayName: author, createdAt: '2026-11-24T08:00:00Z',
  expiresAt, text: 'Story', background: 'indigo',
})
const future = '2099-01-01T00:00:00Z'

it('keeps unseen priority and ignores expired and invalid stories', () => {
  const stories = [story(1, future), story(2, future), story(3, '2020-01-01T00:00:00Z', 'expired'), story(4, 'invalid', 'invalid')]
  const now = Date.parse('2026-11-27T00:00:00Z')
  expect([...avatarStoryStatuses(stories, new Set([1]), now).statuses]).toEqual([['an', 'unseen']])
  expect([...avatarStoryStatuses(stories, new Set([1, 2]), now).statuses]).toEqual([['an', 'seen']])
})

it('updates avatars across the session, expires rings and isolates accounts', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-27T00:00:00Z'))
  const host = document.createElement('div')
  const root = createRoot(host)
  const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  global.IS_REACT_ACT_ENVIRONMENT = true
  const scope = 'avatar-story-integration-test'
  const session = { sessionId: scope, token: 'test', user: { id: 1, username: 'me', displayName: 'Me', email: '' } }
  const stories = [story(98701, '2026-11-27T00:00:01Z'), story(98702, '2026-11-27T00:00:01Z')]
  function Publisher({ scope }: { scope: string }) {
    useAvatarStoryStatuses(scope, stories)
    return null
  }
  function render(sessionId: string) {
    const current = { ...session, sessionId }
    return act(async () => root.render(
      <SessionContext.Provider value={{ session: current, sessionRef: { current } }}>
        <Publisher scope={scope} />
        <UserAvatar name="An" username="an" size="md" />
        <UserAvatar name="An" username="an" size="xs" online />
        <UserAvatar name="An" username="an" group />
      </SessionContext.Provider>,
    ))
  }
  const states = () => [...host.querySelectorAll('[data-story-status]')].map(el => el.getAttribute('data-story-status'))
  try {
    await render(scope)
    expect(states()).toEqual(['unseen', 'unseen', 'none'])
    await act(async () => markStorySeen(scope, 98701))
    expect(states()).toEqual(['unseen', 'unseen', 'none'])
    await act(async () => markStorySeen(scope, 98702))
    expect(states()).toEqual(['seen', 'seen', 'none'])
    await render('different-session')
    expect(states()).toEqual(['none', 'none', 'none'])
    await render(scope)
    expect(states()).toEqual(['seen', 'seen', 'none'])
    await act(async () => { vi.advanceTimersByTime(1001) })
    expect(states()).toEqual(['none', 'none', 'none'])
  } finally {
    await act(async () => root.unmount())
    vi.useRealTimers()
  }
})
