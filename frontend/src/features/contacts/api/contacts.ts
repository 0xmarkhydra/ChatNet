/** API request boundary for Contacts. Consumers own response parsing and UI state. */
export type ContactsRequest = (path: string, init?: RequestInit) => Promise<Response>

export function listFriends(request: ContactsRequest) {
  return request('/api/friends', { cache: 'no-store' })
}

export function listFriendRequests(request: ContactsRequest) {
  return request('/api/friends/requests', { cache: 'no-store' })
}

export function listContactMetadata(request: ContactsRequest) {
  return request('/api/contacts', { cache: 'no-store' })
}

export function updateContactMetadata(
  request: ContactsRequest,
  id: number,
  metadata: { nickname: string; note: string; favorite: boolean },
) {
  return request(`/api/contacts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
}

export function findDirectConversation(request: ContactsRequest, username: string) {
  return request(`/api/conversations?type=direct&q=${encodeURIComponent(username)}&limit=100`, {
    cache: 'no-store',
  })
}

export function updateFriendRelationship(
  request: ContactsRequest,
  id: number,
  relationship: 'accepted' | 'incoming' | 'outgoing' | 'none',
  removing: boolean,
) {
  const path = removing
    ? `/api/friends/${id}?direction=${relationship}`
    : relationship === 'incoming'
      ? `/api/friends/${id}/accept`
      : `/api/friends/${id}`
  return request(path, { method: removing ? 'DELETE' : 'POST' })
}

export function removeAcceptedFriend(request: ContactsRequest, id: number) {
  return request(`/api/friends/${id}?direction=accepted`, { method: 'DELETE' })
}

export function blockUser(request: ContactsRequest, id: number) {
  return request(`/api/users/${id}/block`, { method: 'POST' })
}

export function unblockUser(request: ContactsRequest, id: number) {
  return request(`/api/users/${id}/block`, { method: 'DELETE' })
}

export function listBlockedUsers(request: ContactsRequest) {
  return request('/api/users/blocked')
}

export function reportUser(request: ContactsRequest, id: number, reason: string, details: string) {
  return request(`/api/users/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, details }),
  })
}
