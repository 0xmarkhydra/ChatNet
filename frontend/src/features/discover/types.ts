import type { Dispatch, SetStateAction } from 'react'
import type { FriendSearchResult, FriendConnection } from '../contacts'
import type { ApiRequest } from '../../shared/types/api'
import type { useExploreCommunities } from './hooks/useExploreCommunities'

export type ExploreCommunitiesState = ReturnType<typeof useExploreCommunities>
export type DiscoverSectionProps = {
  request: ApiRequest
  sessionId: string
  actOnFriend: (friend: FriendSearchResult | FriendConnection, decline?: boolean) => Promise<void>
  findNearby: () => Promise<void | string>
  friendActionBusy: number | null
  friendRelationship: (userId: number) => 'accepted' | 'incoming' | 'outgoing' | 'none'
  globalSearch: string
  nearbyBusy: boolean
  nearbyRadiusKm: number
  nearbyResultRadiusKm: number
  nearbyScanning: boolean
  nearbyUntil: number
  nearbyUsers: FriendSearchResult[]
  setGlobalSearch: Dispatch<SetStateAction<string>>
  setNearbyRadiusKm: Dispatch<SetStateAction<number>>
  stopNearby: () => Promise<void>
}