// @vitest-environment jsdom
import { act, useState, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConversationHeader from './ConversationHeader'

vi.mock('../../calls', () => ({ CallHeaderActions: () => <span data-testid="call-actions" /> }));
vi.mock('./ConversationCategories', () => ({ CategoryAssignment: () => null }));
vi.mock('./ConversationAvatar', () => ({ default: () => null }));
vi.mock('../../../shared/ui/UserAvatar', () => ({ default: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => { while (cleanups.length) cleanups.pop()!() })

describe('shared conversation header actions', () => {
  it.each(['direct', 'group', 'channel'] as const)('keeps both responsive action sets in sync for %s', kind => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const search = vi.fn()
    const groupSettings = vi.fn()
    type Props = ComponentProps<typeof ConversationHeader>
    function Harness() {
      const [details, setDetails] = useState(false)
      const [translation, setTranslation] = useState(false)
      const [languageSearch, setLanguageSearch] = useState('')
      const props = {
        activeConversation: { id: 1, type: kind === 'direct' ? 'direct' : 'group', name: 'Hội thoại', memberCount: 2 },
        selectedChannelId: kind === 'channel' ? 3 : 0,
        selectedRoomTitle: 'Hội thoại',
        conversationBlocked: false,
        conversationDetailsOpen: details,
        effectiveAutoTranslate: false,
        effectiveTargetLanguage: 'vi',
        groupSettingsOpen: false,
        languageSearch, setLanguageSearch,
        translationMenuOpen: translation,
        setTranslationMenuOpen: setTranslation,
        setConversationDetailsOpen: setDetails,
        setGroupSettingsOpen: groupSettings,
        setMessageSearchOpen: search,
        visibleLanguageOptions: [],
        t: (key: string) => key,
      } as unknown as Props
      return <ConversationHeader {...props} />
    }
    act(() => root.render(<Harness />))
    cleanups.push(() => { act(() => root.unmount()); host.remove() })
    const mobile = host.querySelector('.group-mobile-actions')!
    const desktop = host.querySelector('.translate-controls')!
    const button = (parent: Element, label: string) =>
      parent.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
    for (const parent of [mobile, desktop]) {
      expect(parent.querySelector('[data-testid="call-actions"]')).not.toBeNull()
      act(() => button(parent, 'Tìm tin nhắn trong cuộc trò chuyện').click())
    }
    expect(search).toHaveBeenNthCalledWith(1, true)
    expect(search).toHaveBeenNthCalledWith(2, true)
    act(() => button(mobile, 'Thông tin hội thoại').click())
    expect(button(desktop, 'Thông tin hội thoại').getAttribute('aria-expanded')).toBe('true')
    act(() => button(desktop, 'Thông tin hội thoại').click())
    expect(button(mobile, 'Thông tin hội thoại').getAttribute('aria-expanded')).toBe('false')
    expect(groupSettings).toHaveBeenCalledWith(false)
    const translationLabel = 'Cài đặt dịch AI, đang tắt'
    act(() => button(mobile, translationLabel).click())
    expect(button(desktop, translationLabel).getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelectorAll('#chat-translation-dialog')).toHaveLength(1)
    act(() => button(desktop, translationLabel).click())
    expect(document.querySelector('#chat-translation-dialog')).toBeNull()
  })
})