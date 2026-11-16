export type FriendSearchResult = {
  id: number
  username: string
  displayName: string
  online: boolean
  distanceKm?: number
  nearbyActive?: boolean
  locationUpdatedAt?: string
  mutualGroups?: number
  reason?: string
}

export type FriendConnection = FriendSearchResult & {
  status: 'accepted' | 'pending'
  direction?: 'incoming' | 'outgoing'
  blockedByMe?: boolean
  blockedByOther?: boolean
  updatedAt: string
}
