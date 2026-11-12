import { useMemo } from 'react'
import type { Conversation } from '../../chat/types'
import type { FriendConnection, FriendSearchResult } from '../types'

export type DirectoryFilter = 'alphabetical' | 'online' | 'favorites'

type Options = {
  friends: FriendConnection[]
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean }>
  embeddedInCalls: boolean
  friendQuery: string
  directoryFilter: DirectoryFilter
  callConversations: Conversation[]
}

const personName = (friend: FriendSearchResult) => friend.displayName || friend.username

export function useContactDirectory({ friends, contactMetadata, embeddedInCalls, friendQuery, directoryFilter, callConversations }: Options) {
  const visibleFriends = useMemo(() => {
    const query = embeddedInCalls ? friendQuery.trim().toLocaleLowerCase('vi-VN') : ''
    const items = [...friends].filter(friend => {
      const inFilter = directoryFilter === 'online' ? friend.online :
        directoryFilter === 'favorites' ? Boolean(contactMetadata[friend.id]?.favorite) : true
      const matchesQuery = !query || [personName(friend), friend.username, contactMetadata[friend.id]?.nickname || '']
        .some(value => value.toLocaleLowerCase('vi-VN').includes(query))
      return inFilter && matchesQuery
    })
    if (directoryFilter === 'alphabetical') items.sort((a, b) =>
      (contactMetadata[a.id]?.nickname || personName(a)).localeCompare(
        contactMetadata[b.id]?.nickname || personName(b), 'vi'))
    return items
  }, [friends, directoryFilter, contactMetadata, embeddedInCalls, friendQuery])
  // The merged call directory keeps direct chats not yet represented by a friend,
  // and group conversations, without showing duplicate friend entries.
  const callSections = useMemo(() => {
    const friendUsernames = new Set(friends.map(friend => friend.username.toLocaleLowerCase('vi-VN')))
    const friendIds = new Set(friends.map(friend => friend.id))
    const search = embeddedInCalls ? friendQuery.trim().toLocaleLowerCase('vi-VN') : ''
    const matches = (conversation: Conversation) => !search || [conversation.name, conversation.otherUsername || '']
      .some(value => value.toLocaleLowerCase('vi-VN').includes(search))
    const all = callConversations.filter(matches)
    return {
      groups: all.filter(conversation => conversation.type === 'group'),
      otherContacts: all.filter(conversation => conversation.type === 'direct' &&
        !(conversation.otherUsername && friendUsernames.has(conversation.otherUsername.toLocaleLowerCase('vi-VN'))) &&
        !(conversation.otherUserId && friendIds.has(conversation.otherUserId))),
    }
  }, [callConversations, friends, friendQuery, embeddedInCalls])

  return { visibleFriends, callSections }
}
