// @vitest-environment jsdom
import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import type { ProfileSectionProps } from './ProfileSection'
import ProfileSection from './ProfileSection'

vi.mock('./ProfileHero', () => ({ default: ({ username }: { username: string }) => <div data-testid="profile-hero">{username}</div> }))
vi.mock('./ProfileNote', () => ({ default: () => null }))
vi.mock('./ProfileAvatarMenu', () => ({ default: () => null }))
vi.mock('../../feed', () => ({ StoryHighlights: () => null }))
vi.mock('../../settings', () => ({ SettingsWorkspace: () => null }))
vi.mock('../../auth', () => ({ AccountSessionsPanel: () => null }))

const friend = {
  id: 42,
  username: 'friend-42',
  displayName: 'Friend 42',
  online: false,
  status: 'accepted' as const,
  updatedAt: '',
}

it('loads Friends on cold /profile open at 390px, after quick profile summary', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const previousWidth = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const apiFetch = vi.fn(async () => new Response(JSON.stringify([friend]), { status: 200 }))
  const session = {
    sessionId: 'session-1',
    user: { username: 'me', displayName: 'Me', email: 'me@example.test' },
  } as Session
  const props = {
    apiFetch,
    isProfileDesktop: false,
    profileTimelineOpen: false,
    session,
    name: 'me',
    appLocale: 'en',
    autoTranslate: false,
    targetLanguage: 'en',
    friends: [],
    friendCount: 1,
    messageSoundEnabled: false,
    pushBusy: false,
    pushEnabled: false,
    nativeNotifications: { enabled: false, toggle: vi.fn(), warning: '' },
    isStandalone: true,
    sessionsBusy: false,
    sessionsOpen: false,
    managedSessions: [],
    blockedBusy: false,
    blockedOpen: false,
    blockedUsers: [],
    blockedError: '',
    onViewFriend: vi.fn(),
    profileMedia: null,
    profileBusy: null,
    mediaUploading: null,
    profileIdentityRef: createRef<HTMLButtonElement>(),
    avatarFileInputRef: createRef<HTMLInputElement>(),
    coverFileInputRef: createRef<HTMLInputElement>(),
    profileHeadingRef: createRef<HTMLHeadingElement>(),
    t: (key: string) => key,
  } as unknown as ProfileSectionProps

  try {
    await act(async () => root.render(<ProfileSection {...props} />))
    expect(apiFetch).toHaveBeenCalledWith('/api/friends', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
    expect(host.textContent).toContain('Friend 42')
    const hero = host.querySelector('[data-testid="profile-hero"]')!
    const friends = host.querySelector('section[aria-label]')!
    expect(hero.compareDocumentPosition(friends) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  } finally {
    await act(async () => root.unmount())
    host.remove()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth })
    vi.unstubAllGlobals()
  }
})
