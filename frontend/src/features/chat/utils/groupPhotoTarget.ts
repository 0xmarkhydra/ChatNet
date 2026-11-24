export type GroupPhotoTarget = {
  name: string
  avatarUrl?: string
  kind?: 'group' | 'avatar' | 'cover' | 'channel'
  channelId?: number
}
