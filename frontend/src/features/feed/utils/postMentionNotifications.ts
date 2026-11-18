export type PostMentionNotification = {
  id: number
  postId: number
  kind?: 'mention' | 'repost' | 'quote'
  author: string
  authorDisplayName: string
  createdAt: string
  readAt?: string | null
}
