import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import ContactCallConversationSection from './ContactCallConversationSection'
import type { Conversation } from '../../chat'

vi.mock('../../calls', () => ({ CallHeaderActions: () => null }))

const group: Conversation = {
  id: 123, type: 'group', name: 'SocCo QA', memberCount: 3, unreadCount: 0,
  online: false, lastMessage: '', createdAt: '2026-01-01T00:00:00Z',
}

it('renders the group photo in the contacts list when available', () => {
  const html = renderToStaticMarkup(<ContactCallConversationSection label="Nhóm"
    items={[{ ...group, avatarUrl: '/api/conversations/123/avatar', avatarMembers: ['member-one'] }]} />)
  expect(html).toContain('src="/api/conversations/123/avatar"')
  expect(html).not.toContain('conversation-avatar-cluster')
})

it('shows the member avatar cluster when no group photo exists', () => {
  const html = renderToStaticMarkup(<ContactCallConversationSection label="Nhóm"
    items={[{ ...group, avatarMembers: ['member-one', 'member-two'] }]} />)
  expect(html).toContain('conversation-avatar-cluster members-2')
  expect(html).toContain('Ảnh đại diện nhóm SocCo QA')
})