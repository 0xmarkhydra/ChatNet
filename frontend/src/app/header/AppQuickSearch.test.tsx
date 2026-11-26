import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { KeyboardEvent } from 'react'
import AppQuickSearch from './AppQuickSearch'

const mocks = vi.hoisted(() => ({
  header: vi.fn((_props: unknown) => null),
  chat: vi.fn((_props: unknown) => null),
}))
vi.mock('./HeaderSearch', () => ({ default: (props: unknown) => mocks.header(props) }))
vi.mock('../../features/chat/components/ChatQuickSearch', () => ({ default: (props: unknown) => mocks.chat(props) }))

function setup(tab: 'chat' | 'feed' | 'profile' | 'contacts' | 'discover', query = '') {
  mocks.header.mockClear()
  const changed: string[] = []
  const tabChanges: string[] = []
  const quickChanges: boolean[] = []
  const navigate = vi.fn()
  renderToStaticMarkup(<AppQuickSearch
    tab={tab} anchorRef={{ current: null }} friendQuery="anna" globalSearch={query}
    conversationSearching={Boolean(query)} quickSearchOpen={true}
    setQuickSearchOpen={value => quickChanges.push(value)}
    setFriendQuery={value => changed.push('friend:' + value)}
    setGlobalSearch={value => changed.push('global:' + value)}
    setTab={value => tabChanges.push(value)}
    navigate={navigate}
    results={{ contacts: [], messages: [], files: [] }} loading={false} error={''} retry={vi.fn()}
    onContact={vi.fn()} onHit={vi.fn()}
  />)
  const props = mocks.header.mock.lastCall?.[0] as {
    value: string; maxLength?: number; controls?: string;
    onMobileSearchOpen?: () => void;
    onChange: (value: string) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  }
  return { props, changed, tabChanges, quickChanges, navigate }
}

describe('AppQuickSearch navigation and presentation', () => {
  it('opens the shared Search component from mobile headers outside Chat', () => {
    for (const tab of ['feed', 'profile', 'contacts', 'discover'] as const) {
      const t = setup(tab)
      expect(t.props.onMobileSearchOpen).toBeTypeOf('function')
      t.props.onMobileSearchOpen?.()
      expect(t.navigate).toHaveBeenCalledExactlyOnceWith('/search')
    }
    expect(setup('chat').props.onMobileSearchOpen).toBeUndefined()
  })
  it('keeps contact search scoped to Contacts', () => {
    const t = setup('contacts', 'global')
    expect(t.props.value).toBe('anna')
    t.props.onChange('john')
    expect(t.changed).toEqual(['friend:john'])
    expect(t.tabChanges).toEqual([])
  })
  it('switches profile header search to Feed without clearing typed query', () => {
    const t = setup('profile')
    t.props.onChange('hello')
    expect(t.changed).toEqual(['global:hello'])
    expect(t.tabChanges).toEqual(['feed'])
  })
  it('preserves Chat search limit and escape closure', () => {
    const t = setup('chat', 'mention')
    expect(t.props.maxLength).toBe(120)
    expect(t.props.controls).toBe('chat-quick-search-results')
    t.props.onChange('new keyword')
    expect(t.quickChanges).toEqual([true])
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    t.props.onKeyDown({ key: 'Escape', preventDefault, stopPropagation } as unknown as KeyboardEvent<HTMLInputElement>)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(t.quickChanges).toEqual([true, false])
  })
  it('routes Discover Enter to encoded full Search URL', () => {
    const t = setup('discover', 'thành phố')
    const preventDefault = vi.fn()
    t.props.onKeyDown({ key: 'Enter', preventDefault } as unknown as KeyboardEvent<HTMLInputElement>)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(t.navigate).toHaveBeenCalledWith('/search?q=' + encodeURIComponent('thành phố'))
  })
})