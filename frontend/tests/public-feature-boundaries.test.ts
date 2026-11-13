import { describe, expect, it } from 'vitest'
import type { Conversation } from '../src/features/chat'
import type { FriendConnection, FriendSearchResult } from '../src/features/contacts'
import type { Post } from '../src/features/feed'
import type { UserPrivacy } from '../src/features/profile'

// Public contracts stay type-only: importing them must not initialize any feature runtime.
describe('public feature type boundaries', () => {
  it('exposes stable types without introducing runtime dependencies', async () => {
    const modules = await Promise.all([
      import('../src/features/chat'),
      import('../src/features/contacts'),
      import('../src/features/feed'),
      import('../src/features/profile'),
      import('../src/features/auth'),
      import('../src/features/pwa'),
    ])
    for (const module of modules) expect(Object.keys(module)).toEqual([])
  })

  it('preserves the consumer-facing contract shapes', () => {
    const conversation = { id: 1, type: 'direct', name: 'A', memberCount: 2, unreadCount: 0, lastMessage: '', online: false, createdAt: '' } satisfies Conversation
    const friend = { id: 1, username: 'a', displayName: 'A', online: true, updatedAt: '', status: 'accepted' } satisfies FriendConnection
    const searchResult: FriendSearchResult = friend
    const post = { id: 1, author: 'a', content: '', likes: 0, liked: false, comments: [], createdAt: '' } satisfies Post
    const privacy = { searchableByUsername: true, searchableByName: true, searchableByEmail: false, allowFriendRequests: true, showOnlineStatus: true } satisfies UserPrivacy
    expect([conversation.id, searchResult.id, post.id, privacy.allowFriendRequests]).toEqual([1, 1, 1, true])
  })
})
