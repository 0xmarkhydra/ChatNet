export type ProfileMediaState = {
  username: string
  displayName: string
  bio?: string
  city?: string
  avatarSet: boolean
  coverSet: boolean
  updatedAt: string
}

export type ProfileUpdateResponse = ProfileMediaState & {
  token: string
}

export type UserPrivacy = {
  searchableByUsername: boolean
  searchableByName: boolean
  searchableByEmail: boolean
  allowFriendRequests: boolean
  showOnlineStatus: boolean
}
