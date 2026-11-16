export type PostMentionNotification = {
  id: number
  postId: number
  author: string
  authorDisplayName: string
  createdAt: string
  readAt?: string | null
}
