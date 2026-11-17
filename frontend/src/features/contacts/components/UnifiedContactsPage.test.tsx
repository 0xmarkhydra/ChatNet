// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import UnifiedContactsPage from './UnifiedContactsPage'

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
  act(() => root.render(<MemoryRouter initialEntries={[path]}><Page /></MemoryRouter>))
  cleanup.push(() => { act(() => root.unmount()); host.remove() })
  const button = (name: string) => {
    const found = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(name))
    if (!found) throw new Error('Missing button ' + name)
    return found
  }
  return { host, button, onOpenChat, route: () => host.querySelector('[data-testid="location"]')?.textContent }
}

describe('Unified Contacts navigation', () => {
  it('keeps friends and call history inside one Danh bạ route', () => {
    const app = mount()
    expect(app.host.querySelector('[data-testid="friends-content"]')).not.toBeNull()
    expect(app.host.querySelector('.unified-contacts-count')?.textContent).toBe('2')
    act(() => app.button('Lịch sử cuộc gọi').click())
    expect(app.route()).toBe('/contacts/calls')
    expect(app.host.querySelector('[data-testid="call-content"]')?.textContent).toBe('history')
    act(() => app.button('Dịch AI cuộc gọi').click())
    expect(app.route()).toBe('/contacts/translation')
    expect(app.host.querySelector('[data-testid="call-content"]')?.textContent).toBe('settings')
    act(() => app.button('Danh sách bạn bè').click())
    expect(app.route()).toBe('/contacts')
    expect(app.host.querySelector('[data-testid="friends-content"]')).not.toBeNull()
  })

  it('shows group conversations and invitation navigation without losing contacts', () => {
    const app = mount('/contacts/groups')
    expect(app.host.textContent).toContain('Nhóm của bạn: 1')
    act(() => app.button('Lời mời kết bạn').click())
    expect(app.route()).toBe('/contacts/requests')
    expect(app.host.querySelector('[data-testid="friends-content"]')).not.toBeNull()
  })
})
