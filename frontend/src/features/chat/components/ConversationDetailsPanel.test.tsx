// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConversationDetailsPanel from './ConversationDetailsPanel'
import type { Conversation } from '../types'
import type { GroupChannel } from '../utils/groupChannels'

vi.mock('./ConversationSharedPreview', () => ({
  default: () => <div data-testid="media-preview" />,
}))
vi.mock('./GroupChannelControls', () => ({
  default: () => <div data-testid="channel-controls" />,
}))
vi.mock('./GroupAvatarEditor', () => ({
  default: ({ target, onClose }: { target: { name: string; kind?: string }; onClose: () => void }) =>
    <div role="dialog" aria-label={`Chỉnh ảnh ${target.kind}: ${target.name}`}>
      <button type="button" onClick={onClose}>Đóng chỉnh ảnh</button>
    </div>,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const unmounts: Array<() => void> = []
afterEach(() => {
  while (unmounts.length) unmounts.pop()!()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const group = (id: number): Conversation => ({
  id, type: 'group', name: `Nhóm ${id}`, memberCount: 7,
  unreadCount: 0, lastMessage: '', online: false, createdAt: '',
} as Conversation)
const general = (groupId: number): GroupChannel => ({
  id: 0, conversationId: groupId, name: 'Thảo luận chung', description: '', unreadCount: 0, lastMessage: '',
})
const topic = (groupId: number): GroupChannel => ({
  id: 25, conversationId: groupId, name: 'Công việc', description: '', unreadCount: 0, lastMessage: '',
})

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const defaults = {
    conversation: group(41),
    busy: false, notificationBusy: false, photoBusy: false, channelCreateBusy: false,
    onToggleNotifications: vi.fn(), onClose: vi.fn(), onProfile: vi.fn(), onShared: vi.fn(),
    request: vi.fn(async () => Response.json({})),
    selectedChannelId: 0, channel: general(41), userId: 5,
    canLeaveGroup: true, notify: vi.fn(), onGroupRenamed: vi.fn(),
    onChannelsChanged: vi.fn(async () => {}), onChannelDeleted: vi.fn(async () => {}),
    onLeftGroup: vi.fn(), onGroupManagement: vi.fn(),
    canCreateChannel: true, onCreateChannel: vi.fn(async () => false),
    canEditGroupPhotos: true, onSavePhoto: vi.fn(async () => true),
    onBlock: vi.fn(), onUnblock: vi.fn(), onClearHistory: vi.fn(),
  }
  const render = (overrides: Partial<typeof defaults> = {}) =>
    act(() => root.render(<ConversationDetailsPanel {...defaults} {...overrides} />))
  render()
  unmounts.push(() => { act(() => root.unmount()); host.remove() })
  const button = (label: string): HTMLButtonElement => {
    const item = [...host.querySelectorAll('button')].find(el =>
      (el.getAttribute('aria-label') ?? el.textContent?.trim())?.includes(label))
    if (!item) throw new Error(`Missing button ${label}`)
    return item
  }
  return { host, button, render, defaults }
}

describe('ConversationDetailsPanel scoped UI state', () => {
  it('closes an open group-photo dialog when switching to a channel of the same group', () => {
    const page = mount()
    act(() => page.button('Đổi ảnh nhóm').click())
    expect(page.host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('group: Nhóm 41')
    page.render({ selectedChannelId: 25, channel: topic(41) })
    expect(page.host.querySelector('[role="dialog"]')).toBeNull()
    expect(page.host.querySelector('h2')?.textContent).toBe('Thông tin kênh')
    act(() => page.button('Đổi ảnh kênh').click())
    expect(page.host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('channel: Công việc')
  })

  it('clears an expanded channel creation form on channel switch and on returning to the group', () => {
    const page = mount()
    act(() => page.button('Tạo kênh').click())
    const input = page.host.querySelector('input[aria-label="Tên kênh mới"]') as HTMLInputElement
    expect(input).not.toBeNull()
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Kênh tạm')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(input.value).toBe('Kênh tạm')
    page.render({ selectedChannelId: 25, channel: topic(41) })
    expect(page.host.querySelector('input[aria-label="Tên kênh mới"]')).toBeNull()
    page.render()
    expect(page.host.querySelector('input[aria-label="Tên kênh mới"]')).toBeNull()
    act(() => page.button('Tạo kênh').click())
    expect((page.host.querySelector('input[aria-label="Tên kênh mới"]') as HTMLInputElement).value).toBe('')
  })

  it('isolates the photo dialog when navigating between two different group conversations', () => {
    const page = mount()
    act(() => page.button('Đổi ảnh nhóm').click())
    page.render({ conversation: group(52), channel: general(52) })
    expect(page.host.querySelector('[role="dialog"]')).toBeNull()
    expect(page.host.querySelector('strong[title]')?.textContent).toBe('Nhóm 52')
  })

  it('preserves group-management callbacks and does not expose group settings in channel view', () => {
    const page = mount()
    act(() => page.button('Thành viên').click())
    expect(page.defaults.onGroupManagement).toHaveBeenCalledWith('members')
    expect(page.host.textContent).not.toContain('Bình chọn')
    expect(page.host.textContent).not.toContain('Quyền quản trị')
    expect(page.button('Bảng tin nhóm')).not.toBeNull()
    page.render({ selectedChannelId: 25, channel: topic(41) })
    expect(page.host.textContent).not.toContain('Tạo kênh')
    expect(page.host.textContent).not.toContain('Bình chọn')
  })
  it('preserves direct-message actions and does not render group-only controls', () => {
    const page = mount()
    const direct = { ...group(80), type: 'direct' as const, name: 'Bạn A', memberCount: 2,
      otherUserId: 90, blockedByMe: false, blockedByOther: false }
    page.render({ conversation: direct, channel: general(80) })
    expect(page.host.textContent).not.toContain('Quản lý nhóm')
    expect(page.host.textContent).not.toContain('Tạo kênh')
    act(() => page.button('Hồ sơ').click())
    expect(page.defaults.onProfile).toHaveBeenCalledOnce()
    act(() => page.button('Chặn tin nhắn và cuộc gọi').click())
    expect(page.defaults.onBlock).toHaveBeenCalledOnce()
    act(() => page.button('Xóa lịch sử trò chuyện').click())
    expect(page.defaults.onClearHistory).toHaveBeenCalledOnce()
  })

  it('uses the group management layout on phones while preserving direct-only actions', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })))
    const page = mount()
    const groupSection = page.host.querySelector('section[aria-label="Quản lý nhóm"]')
    expect(groupSection?.classList.contains('conversation-info-group-menu')).toBe(true)
    const direct = { ...group(80), type: 'direct' as const, name: 'Bạn A', memberCount: 2,
      otherUserId: 90, blockedByMe: false, blockedByOther: false }
    page.render({ conversation: direct, channel: general(80) })
    const section = page.host.querySelector('section[aria-label="Quản lý hội thoại"]')
    expect(section?.className).toBe(groupSection?.className)
    expect(section?.contains(page.button('Hồ sơ'))).toBe(true)
    expect(section?.contains(page.button('Tắt thông báo hội thoại'))).toBe(true)
    expect(page.host.querySelector('section[aria-label="Riêng tư và lịch sử"]')?.contains(page.button('Chặn tin nhắn và cuộc gọi'))).toBe(true)
    expect(page.host.querySelector('.group-photo-avatar-wrap .social-chat-details-avatar')).not.toBeNull()
    expect(page.host.querySelector('.group-photo-trigger')).toBeNull()
    expect(page.host.textContent).not.toContain('Quản lý nhóm')
    act(() => page.button('Tắt thông báo hội thoại').click())
    expect(page.defaults.onToggleNotifications).toHaveBeenCalledOnce()
    page.render({ conversation: { ...direct, muted: true, blockedByMe: true } })
    expect(page.button('Bật thông báo hội thoại').getAttribute('aria-pressed')).toBe('true')
    act(() => page.button('Bỏ chặn người dùng').click())
    expect(page.defaults.onUnblock).toHaveBeenCalledOnce()
    page.render({ conversation: { ...direct, blockedByOther: true } })
    expect(page.host.textContent).not.toContain('Chặn tin nhắn và cuộc gọi')
  })

  it('shares the group identity layout for desktop direct settings', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })))
    const page = mount()
    page.render({ conversation: { ...group(80), type: 'direct' as const, otherUserId: 90 } })
    expect(page.host.querySelector('[aria-label="Quản lý hội thoại"]')?.contains(page.button('Hồ sơ'))).toBe(true)
    expect(page.host.querySelector('[aria-label="Riêng tư và lịch sử"]')?.contains(page.button('Xóa lịch sử trò chuyện'))).toBe(true)
    expect(page.host.querySelector('.group-photo-avatar-wrap .social-chat-details-avatar')).not.toBeNull()
    expect(page.host.querySelector('.group-photo-trigger')).toBeNull()
    expect(page.button('Hồ sơ').querySelector('span')?.textContent).toBe('Hồ sơ')
  })
})