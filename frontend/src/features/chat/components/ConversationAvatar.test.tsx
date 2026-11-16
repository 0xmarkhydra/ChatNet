import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Conversation } from '../types'
import ConversationAvatar from './ConversationAvatar'

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    type: 'group',
    name: 'Nhóm thiết kế',
    memberCount: 4,
    unreadCount: 0,
    lastMessage: '',
    online: false,
    createdAt: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

describe('ConversationAvatar', () => {
  it('uses three distinct participant profile pictures for a group without a photo', () => {
    const html = renderToStaticMarkup(
      <ConversationAvatar conversation={conversation({ avatarMembers: ['linh', 'an', 'binh', 'minh'] })} className="conversation-avatar" />,
    )
    expect(html.match(/class="conversation-avatar-member/g)).toHaveLength(3)
    expect(html).toContain('/api/users/linh/avatar')
    expect(html).toContain('/api/users/an/avatar')
    expect(html).toContain('/api/users/binh/avatar')
    expect(html).not.toContain('/api/users/minh/avatar')
  })

  it('prefers the uploaded group photo over member pictures', () => {
    const html = renderToStaticMarkup(
      <ConversationAvatar conversation={conversation({ avatarUrl: 'https://example.test/group.jpg', avatarMembers: ['linh', 'an', 'binh'] })} className="room-avatar" />,
    )
    expect(html).toContain('https://example.test/group.jpg')
    expect(html).not.toContain('conversation-avatar-cluster')
  })

  it('uses the other user profile for a direct chat', () => {
    const html = renderToStaticMarkup(
      <ConversationAvatar conversation={conversation({ type: 'direct', name: 'Bạn Linh', otherUsername: 'linh', online: true })} className="conversation-avatar" />,
    )
    expect(html).toContain('/api/users/linh/avatar')
    expect(html).toContain('presence-dot')
    expect(html).not.toContain('conversation-avatar-cluster')
  })

  it('handles small groups and older API responses', () => {
    const two = renderToStaticMarkup(
      <ConversationAvatar conversation={conversation({ avatarMembers: ['linh', 'an'] })} className="room-avatar" />,
    )
    const fallback = renderToStaticMarkup(
      <ConversationAvatar conversation={conversation()} className="room-avatar" />,
    )
    expect(two).toContain('members-2')
    expect(fallback).toContain('👥')
  })
})
