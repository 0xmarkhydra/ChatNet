import { describe, expect, it, vi } from 'vitest'
import { createAppTabSwitch, type AppTabSwitchDependencies } from './createAppTabSwitch'

function makeDeps(overrides: Partial<AppTabSwitchDependencies> = {}) {
  const actions: string[] = []
  const callback = (name: string) => (value: unknown) => { actions.push(`${name}:${String(value)}`) }
  const navigate = vi.fn((destination: unknown, options?: unknown) => {
    actions.push('navigate:' + JSON.stringify({ destination, options }))
  })
  const deps = {
    setDesktopSection: callback('section'),
    setFeedCommunitiesOpen: callback('communities'),
    setTranslationSettingsConversationId: callback('translation'),
    setProfileEditorOpen: callback('editor'),
    activePostId: 8,
    setActivePostId: callback('post'),
    routeLocation: { pathname: '/feed', search: '?post=8' },
    navigate,
    setQuickSearchOpen: callback('quickSearch'),
    setTab: callback('tab'),
    setQuickCreateOpen: callback('quickCreate'),
    setGlobalSearch: callback('search'),
    setActiveConversationId: callback('conversation'),
    setFriendQuery: callback('friends'),
    ...overrides,
  } as unknown as AppTabSwitchDependencies
  return { actions, navigate, deps }
}

describe('app tab navigation teardown', () => {
  it('clears post deep-link without adding browser history and resets non-chat state in order', () => {
    const { actions, navigate, deps } = makeDeps()
    createAppTabSwitch(deps)('contacts')
    expect(navigate).toHaveBeenCalledWith({ pathname: '/feed', search: '' }, { replace: true })
    expect(actions).toEqual([
      'section:null', 'communities:false', 'translation:null', 'post:null',
      'navigate:{"destination":{"pathname":"/feed","search":""},"options":{"replace":true}}',
      'quickSearch:false', 'tab:contacts', 'quickCreate:false', 'search:',
      'conversation:null',
    ])
  })

  it('keeps chat selection on chat navigation, and closes profile editor only for profile tab', () => {
    const { actions, navigate, deps } = makeDeps({
      activePostId: null, routeLocation: { pathname: '/chat', search: '' },
    })
    createAppTabSwitch(deps)('chat')
    expect(actions).not.toContain('conversation:null')
    expect(actions).not.toContain('editor:false')
    expect(navigate).not.toHaveBeenCalled()
    actions.length = 0
    createAppTabSwitch(deps)('profile')
    expect(actions).toContain('editor:false')
    expect(actions).toContain('conversation:null')
    expect(actions).toContain('friends:')
  })

  it('preserves unrelated query arguments when the current route has no active post', () => {
    const { navigate, deps } = makeDeps({
      activePostId: null, routeLocation: { pathname: '/feed', search: '?filter=saved' },
    })
    createAppTabSwitch(deps)('notifications')
    expect(navigate).not.toHaveBeenCalled()
  })
})