// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChatSection from './ChatSection'
import type { ChatSectionProps } from './ChatSectionProps'
import type { Conversation } from '../types'

const { savePhoto } = vi.hoisted(() => ({
  savePhoto: { current: null as null | ((target: unknown, file: File | null) => Promise<boolean>) },
}))

vi.mock('./ConversationDetailsPanel', () => ({
  default: ({ onSavePhoto }: { onSavePhoto: (target: unknown, file: File | null) => Promise<boolean> }) => {
    savePhoto.current = onSavePhoto
    return null
  },
}))
vi.mock('./GroupChannelSidebar', () => ({ default: () => null }))
vi.mock('./ConversationAvatarRail', () => ({ default: () => null }))
vi.mock('./ConversationRailControls', () => ({ default: () => null }))
vi.mock('./DesktopConversationRail', () => ({ default: () => null }))
vi.mock('./ConversationList', () => ({ default: () => null }))
vi.mock('./ConversationHeader', () => ({ default: () => null }))
vi.mock('./MessageComposer', () => ({ default: () => null }))
vi.mock('./MessageTimeline', () => ({ default: () => null }))
vi.mock('./GroupSettingsPanel', () => ({ default: () => null }))
vi.mock('./SharedContent', () => ({ default: () => null }))
vi.mock('./MessageSearchPanel', () => ({ default: () => null }))
vi.mock('./MessageReadersDialog', () => ({ default: () => null }))
vi.mock('./PinnedItemsPanel', () => ({ default: () => null }))
vi.mock('./E2EEPilotGate', () => ({ default: () => null }))
vi.mock('./ConversationAvatar', () => ({ default: () => null }))
vi.mock('./ConversationCategories', () => ({ default: () => null, CategoryBadge: () => null, CategoryAssignment: () => null }))
vi.mock('../../calls', () => ({ CallHeaderActions: () => null }))
vi.mock('../../../shared/ui/useSlidingPill', () => ({ default: () => ({}) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const unmounts: Array<() => void> = []

afterEach(() => {
  while (unmounts.length) unmounts.pop()!()
  savePhoto.current = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const group = (id: number): Conversation => ({
  id, type: 'group', name: `Group ${id}`, memberCount: 3,
  unreadCount: 0, lastMessage: '', online: false, createdAt: '',
} as Conversation)

function mount(activeConversation = group(41), canEditGroup = true) {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const conversations = [activeConversation, group(52)]
  const setConversations = vi.fn((update: Conversation[] | ((current: Conversation[]) => Conversation[])) => {
    const current = conversations.slice()
    const next = typeof update === 'function' ? update(current) : update
    conversations.splice(0, conversations.length, ...next)
  })
  const apiFetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>()
  const uploadMediaFiles = vi.fn(async () => [{
    storageRef: 'group/avatar/41', name: 'group.png', sizeBytes: 5,
    contentType: 'image/png', kind: 'image' as const, url: 'https://cdn.invalid/group.png',
  }])
  const refreshGroupChannels = vi.fn(async () => {})
  const setNotice = vi.fn()
  const callback = vi.fn()
  const refs = { current: null }
  const arrays = new Set([
    'allChatConversations', 'chatListConversations', 'chatOutbox', 'friends', 'friendResults',
    'groupChannels', 'groupInviteCandidates', 'groupInviteSelection', 'groupMembers', 'languageOptions',
    'messageAttachments', 'pinnedItems', 'sortedChatListConversations', 'sortedGroupActivityEvents',
    'visibleConversations', 'visibleLanguageOptions', 'visibleMessages',
  ])
  const props = new Proxy({
    activeConversation, activeConversationId: activeConversation.id,
    activeConversationIdRef: { current: activeConversation.id }, activeGroupMember: null,
    apiFetch, uploadMediaFiles, refreshGroupChannels, setConversations, setNotice,
    canEditGroup, conversationDetailsOpen: true, groupSettingsOpen: false,
    selectedChannelId: 0, session: { sessionId: 'session-1', user: { id: 9 } },
    conversationListSearch: { active: false, items: [], loading: false, loadingMore: false, hasMore: false, error: '', retry: callback, loadMore: callback },
    conversationCategories: {
      categories: [], selected: null, select: callback, items: [], hasMore: false, loading: false,
      busy: false, error: '', listError: '', load: callback, save: callback, remove: callback,
      assign: callback, refreshCategories: callback, refreshFiltered: callback, applyAssignment: callback,
    },
    groupActivities: { activities: [], events: [], error: '', refresh: callback, create: callback, vote: callback, setPin: callback },
    newChatMode: 'none', chatListFilter: 'all', t: (key: string) => key,
  }, {
    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...arrays])]
    },
    getOwnPropertyDescriptor(target, key) {
      return Reflect.getOwnPropertyDescriptor(target, key) ?? { configurable: true, enumerable: true }
    },
    get(target, key, receiver) {
      if (Reflect.has(target, key)) return Reflect.get(target, key, receiver)
      if (arrays.has(String(key))) return []
      if (String(key).endsWith('Ref')) return refs
      if (/^(set|change|refresh|create|clear|copy|invite|load|open|remove|retry|select|send|share|switch|toggle|translate|update|unblock|block|act|next|search)/.test(String(key))) return callback
      return undefined
    },
  }) as unknown as ChatSectionProps
  act(() => root.render(<ChatSection {...props} />))
  unmounts.push(() => { act(() => root.unmount()); host.remove() })
  return { apiFetch, uploadMediaFiles, refreshGroupChannels, setConversations, setNotice, conversations }
}

describe('ChatSection saveGroupPhoto behavior', () => {
  it('checks group capability, uploads to profile, saves attachment, and updates only matching conversation', async () => {
    const page = mount()
    page.apiFetch
      .mockResolvedValueOnce(Response.json({ canUpdateAvatar: true }))
      .mockResolvedValueOnce(Response.json({ conversationId: 41, avatarUrl: 'https://cdn.invalid/new.png', avatarSet: true }))
    const file = new File(['photo'], 'group.png', { type: 'image/png' })
    let saved = false

    await act(async () => { saved = await savePhoto.current!({ kind: 'group', name: 'Group 41' }, file) })

    expect(saved).toBe(true)
    expect(page.apiFetch).toHaveBeenNthCalledWith(1, '/api/conversations/41/avatar', { method: 'GET', cache: 'no-store' })
    expect(page.uploadMediaFiles).toHaveBeenCalledWith([file], 'profile')
    expect(page.apiFetch).toHaveBeenNthCalledWith(2, '/api/conversations/41/avatar', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachment: {
        storageRef: 'group/avatar/41', name: 'group.png', sizeBytes: 5,
        contentType: 'image/png', kind: 'image',
      } }),
    })
    expect(page.conversations[0].avatarUrl).toBe('https://cdn.invalid/new.png')
    expect(page.conversations[1].avatarUrl).toBeUndefined()
    expect(page.setNotice).toHaveBeenCalledWith('Đã cập nhật ảnh nhóm.', 'success')
  })

  it('uses channel avatar endpoints and refreshes channels after confirmed save', async () => {
    const page = mount()
    page.apiFetch
      .mockResolvedValueOnce(Response.json({ canUpdateAvatar: true }))
      .mockResolvedValueOnce(Response.json({ conversationId: 41, avatarUrl: 'https://cdn.invalid/channel.png', avatarSet: true }))

    let saved = false
    await act(async () => { saved = await savePhoto.current!({ kind: 'channel', channelId: 25, name: 'Topic' }, null) })

    expect(saved).toBe(true)
    expect(page.apiFetch).toHaveBeenNthCalledWith(1, '/api/conversations/41/channels/25/avatar', { cache: 'no-store' })
    expect(page.uploadMediaFiles).not.toHaveBeenCalled()
    expect(page.apiFetch).toHaveBeenNthCalledWith(2, '/api/conversations/41/channels/25/avatar', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attachment: null }),
    })
    expect(page.refreshGroupChannels).toHaveBeenCalledOnce()
    expect(page.setConversations).not.toHaveBeenCalled()
    expect(page.setNotice).toHaveBeenCalledWith('Đã cập nhật ảnh kênh.', 'success')
  })

  it('stops when capability denies update and reports backend error', async () => {
    const page = mount()
    page.apiFetch.mockResolvedValueOnce(Response.json({ canUpdateAvatar: false }))
    let saved = true

    await act(async () => { saved = await savePhoto.current!({ kind: 'group', name: 'Group 41' }, new File(['x'], 'x.png')) })

    expect(saved).toBe(false)
    expect(page.apiFetch).toHaveBeenCalledOnce()
    expect(page.uploadMediaFiles).not.toHaveBeenCalled()
    expect(page.setNotice).toHaveBeenCalledWith(expect.stringContaining('Backend hiện tại chưa hỗ trợ lưu ảnh nhóm'), 'error')
  })

  it('does not request or upload a photo when current user cannot edit group', async () => {
    const page = mount(group(41), false)
    let saved = true

    await act(async () => { saved = await savePhoto.current!({ kind: 'group', name: 'Group 41' }, new File(['x'], 'x.png')) })

    expect(saved).toBe(false)
    expect(page.apiFetch).not.toHaveBeenCalled()
    expect(page.uploadMediaFiles).not.toHaveBeenCalled()
    expect(page.setNotice).not.toHaveBeenCalled()
  })
})
