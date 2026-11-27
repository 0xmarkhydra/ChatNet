// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import UnifiedContactsPage from './UnifiedContactsPage'
import { UiLocaleContext } from '@/shared/i18n/locale'

vi.mock('../../calls/components/CallCenter', () => ({
  default: ({ contactMode }: { contactMode: string }) => <div data-testid="call-content">{contactMode}</div>,
}))
vi.mock('./ContactCallConversationSection', () => ({
  default: ({ label, items }: { label: string; items: unknown[] }) => <div>{label}: {items.length}</div>,
}))

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = globals.IS_REACT_ACT_ENVIRONMENT
const cleanup: Array<() => void> = []
afterEach(() => {
  while (cleanup.length) cleanup.pop()!()
  globals.IS_REACT_ACT_ENVIRONMENT = previousAct
})

function mount(path = '/contacts') {
  globals.IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onOpenChat = vi.fn()
  function Page() {
    const location = useLocation()
    return <>
      <output data-testid="location">{location.pathname}</output>
      <UnifiedContactsPage
        contactsContent={<div data-testid="friends-content">Danh sách và lời mời</div>}
        conversations={[{
          id: 7, name: 'Nhóm dự án', type: 'group', memberCount: 3,
          unreadCount: 0, lastMessage: '', online: false, createdAt: '',
        }]}
        friends={[]}
        incomingRequests={2}
        request={() => Promise.resolve(new Response('{}'))}
        userId={1} token="test" targetLanguage="vi"
        friendQuery="" setFriendQuery={() => undefined}
        onOpenChat={onOpenChat}
        onNavigate={() => undefined}
      />
    </>
  }
  const setLocale = (locale: string) => act(() => root.render(<UiLocaleContext.Provider value={{ locale }}><MemoryRouter initialEntries={[path]}><Page /></MemoryRouter></UiLocaleContext.Provider>))
  setLocale('vi')
  cleanup.push(() => { act(() => root.unmount()); host.remove() })
  const button = (name: string) => {
    const found = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(name))
    if (!found) throw new Error('Missing button ' + name)
    return found
  }
  return { host, button, onOpenChat, setLocale, route: () => host.querySelector('[data-testid="location"]')?.textContent }
}

describe('Unified Contacts navigation', () => {
  it('uses accessible horizontal-style tabs while preserving every destination', () => {
    const app = mount()
    const nav = app.host.querySelector('.unified-contacts-nav nav')
    expect(nav?.getAttribute('aria-label')).toBe('Danh mục danh bạ')
    expect(nav?.querySelectorAll('button')).toHaveLength(6)
    expect(nav?.querySelector('button svg')).toBeNull()
    expect([...nav!.querySelectorAll('button > span')].map(item => item.textContent)).toEqual([
      'Bạn bè', 'Nhóm chat', 'Lời mời', 'Cuộc gọi', 'Khám phá', 'Dịch AI',
    ])
    expect(app.button('Bạn bè').getAttribute('aria-current')).toBe('page')
    expect(app.button('Lời mời').querySelector('small')?.textContent).toBe('2')
    act(() => app.button('Khám phá').click())
    expect(app.route()).toBe('/contacts/overview')
    expect(app.button('Khám phá').classList.contains('active')).toBe(true)
  })

  it('keeps friends and call history inside one Danh bạ route', () => {
    const app = mount()
    expect(app.host.querySelector('[data-testid="friends-content"]')).not.toBeNull()
    expect(app.host.querySelector('.unified-contacts-count')?.textContent).toBe('2')
    act(() => app.button('Cuộc gọi').click())
    expect(app.route()).toBe('/contacts/calls')
    expect(app.host.querySelector('[data-testid="call-content"]')?.textContent).toBe('history')
    act(() => app.button('Dịch AI').click())
    expect(app.route()).toBe('/contacts/translation')
    expect(app.host.querySelector('[data-testid="call-content"]')?.textContent).toBe('settings')
    act(() => app.button('Bạn bè').click())
    expect(app.route()).toBe('/contacts')
    expect(app.host.querySelector('[data-testid="friends-content"]')).not.toBeNull()
  })

  it('shows group conversations and invitation navigation without losing contacts', () => {
    const app = mount('/contacts/groups')
    expect(app.host.textContent).toContain('Nhóm của bạn: 1')
    act(() => app.button('Lời mời').click())
    expect(app.route()).toBe('/contacts/requests')
    expect(app.host.querySelector('[data-testid="friends-content"]')).not.toBeNull()
  })
})

it('updates directory navigation and headings across all five locales without losing the route', () => {
  const app = mount()
  for (const [locale, title, friends, groups, requests] of [
    ['vi','Danh sách bạn bè','Bạn bè','Nhóm chat','Lời mời'],
    ['en','Friends list','Friends','Group chats','Requests'],
    ['zh','好友列表','好友','群聊','请求'],
    ['ja','友達リスト','友達','グループチャット','リクエスト'],
    ['ko','친구 목록','친구','그룹 채팅','요청'],
  ]) {
    app.setLocale(locale)
    expect(app.host.querySelector('.unified-contacts-heading h1')?.textContent).toBe(title)
    expect(Array.from(app.host.querySelectorAll('.unified-contacts-nav button > span')).slice(0,3).map(el => el.textContent)).toEqual([friends,groups,requests])
    expect(app.host.querySelector('.unified-contacts-count')?.textContent).toBe('2')
    expect(app.route()).toBe('/contacts')
  }
})
